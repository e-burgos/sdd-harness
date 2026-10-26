import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MAX_FRAME_BYTES, PROTOCOL_VERSION, defaultThreadOptions, type ServerMessage } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { DEFAULT_ORIGINS, startBridge } from './main';
import { copyFixture, waitFor } from './test-utils/fixture';

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (name: string, extra: number) => ({
  kind: 'image' as const, name, mime: 'image/png' as const, width: 2, height: 2, data: Buffer.from([...PNG_HEAD, extra]).toString('base64'),
});
const note = (name: string, text: string) => ({ kind: 'text' as const, name, mime: 'text/plain' as const, text });

let root: string;
let cleanup: () => Promise<void>;
let closeBridge: () => Promise<void>;
let ws: WebSocket;
let inbox: ServerMessage[];
let counter = 0;
let welcome: Extract<ServerMessage, { kind: 'welcome' }>;

beforeEach(async () => {
  ({ root, cleanup } = await copyFixture());
  await mkdir(path.join(root, '.claude/skills/commit'), { recursive: true });
  await writeFile(path.join(root, '.claude/skills/commit/SKILL.md'), '---\nname: commit\ndescription: Commits\n---\n');
  await writeFile(path.join(root, 'notes.md'), 'x');
  await writeFile(path.join(root, '.env'), 'SECRET=1');
  const bridge = await startBridge({ root, port: 0, strictPort: true, engine: 'fake', allowedOrigins: DEFAULT_ORIGINS, webUrl: 'https://example.test' });
  closeBridge = bridge.close;
  inbox = [];
  ws = new WebSocket(`ws://127.0.0.1:${bridge.port}`);
  ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
  await new Promise((resolve) => ws.once('open', resolve));
  ws.send(JSON.stringify({ kind: 'hello', token: bridge.token, protocolVersion: PROTOCOL_VERSION, clientVersion: 't' }));
  welcome = await waitFor(() => inbox.find((m): m is typeof welcome => m.kind === 'welcome'));
});
afterEach(async () => {
  ws.close();
  await closeBridge();
  await cleanup();
});

async function request<T = unknown>(command: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: { code: string; message: string } }> {
  const id = `r${++counter}`;
  ws.send(JSON.stringify({ kind: 'command', id, ...command }));
  const result = await waitFor(() => inbox.find((m) => m.kind === 'result' && m.id === id));
  return result as never;
}
const data = async <T = unknown>(command: Record<string, unknown>): Promise<T> => {
  const result = await request<T>(command);
  if (!result.ok) throw new Error(`${command.cmd} failed: ${result.error.message}`);
  return result.data;
};

type Thread = { id: string };
type ThreadEventMessage = Extract<ServerMessage, { kind: 'thread.event' }>;
const eventsOf = (threadId: string) =>
  inbox.filter((m): m is ThreadEventMessage => m.kind === 'thread.event' && m.threadId === threadId).map((m) => m.event);
const deltas = (threadId: string) => eventsOf(threadId).flatMap((e) => (e.type === 'message.delta' ? [e.text] : []));
const create = (extra: Record<string, unknown>) =>
  data<Thread>({ cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), ...extra });
const turnEnded = (threadId: string) => eventsOf(threadId).some((e) => e.type === 'turn.end');

describe('bridge with attachments, file search and catalog', () => {
  it('announces the three capabilities in the welcome', () => {
    expect(welcome.features).toEqual(expect.arrayContaining(['attachments', 'file-search', 'catalog']));
  });

  it('creates a thread with attachments and refs, and the model sees them', async () => {
    const t = await create({
      text: '/commit ship it', attachments: [png('a.png', 1), note('n.txt', 'hello')], refs: { agents: ['sdd-planner', 'ghost'], skills: ['commit'] },
    });
    await waitFor(() => turnEnded(t.id));
    expect(eventsOf(t.id).find((e) => e.type === 'user.message')).toMatchObject({
      text: '/commit ship it', attachments: [{ name: 'a.png', kind: 'image' }, { name: 'n.txt', kind: 'text' }], refs: { agents: ['sdd-planner'], skills: ['commit'] },
    });
    expect(deltas(t.id)).toEqual(['echo: ship it [attachments: a.png, n.txt] [refs: @sdd-planner /commit]']);
  });

  it('queues a message with attachments sent during a running turn and delivers it at a cut point', async () => {
    const t = await create({ text: '#steps:10' });
    const sent = await data<{ delivery: string; pendingId: string }>({ cmd: 'thread.send', threadId: t.id, text: 'look', attachments: [png('b.png', 2)] });
    expect(sent.delivery).toBe('pending');
    expect(eventsOf(t.id).find((e) => e.type === 'pending.added')).toMatchObject({ pendingId: sent.pendingId, attachments: [{ name: 'b.png' }] });
    await waitFor(() => turnEnded(t.id));
    expect(deltas(t.id)).toContain('heard: look [attachments: b.png]');
  });

  it('reloads an attachment from history with attachment.get', async () => {
    const upload = png('c.png', 3);
    const t = await create({ text: 'see', attachments: [upload] });
    await waitFor(() => turnEnded(t.id));
    const history = await data<Array<{ event: { type: string; attachments?: Array<{ sha256: string; mime: string }> } }>>({ cmd: 'thread.history', threadId: t.id, sinceSeq: 0 });
    const ref = history.find((h) => h.event.type === 'user.message')?.event.attachments?.[0];
    expect(ref).toBeDefined();
    expect(await data({ cmd: 'attachment.get', sha256: ref!.sha256, mime: ref!.mime })).toEqual({ sha256: ref!.sha256, mime: 'image/png', data: upload.data });
  });

  it('answers attachment.get for unknown content with a generic not-found', async () => {
    const result = await request({ cmd: 'attachment.get', sha256: 'f'.repeat(64), mime: 'image/png' });
    expect(result).toMatchObject({ ok: false, error: { code: 'not-found', message: 'attachment not available' } });
  });

  it('rejects an upload whose content does not match its mime and creates no thread', async () => {
    const before = (await data<Thread[]>({ cmd: 'thread.list' })).length;
    const result = await request({
      cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'x',
      attachments: [{ ...png('fake.png', 0), data: Buffer.from('plain text').toString('base64') }],
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'bad-request' } });
    expect(await data<Thread[]>({ cmd: 'thread.list' })).toHaveLength(before);
  });

  it('searches files without exposing secrets', async () => {
    const hit = await data<{ files: Array<{ path: string }>; source: string }>({ cmd: 'workspace.searchFiles', query: 'notes' });
    expect(hit.files).toEqual([{ path: 'notes.md' }]);
    const env = await data<{ files: Array<{ path: string }> }>({ cmd: 'workspace.searchFiles', query: 'env', limit: 20 });
    expect(env.files.map((f) => f.path)).not.toContain('.env');
  });

  it('lists the catalog skills in the snapshot', async () => {
    const snapshot = await data<{ skills: Array<{ id: string; kind: string }>; agents: Array<{ id: string }> }>({ cmd: 'workspace.snapshot' });
    expect(snapshot.skills).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'commit', kind: 'skill' })]));
    expect(snapshot.agents.map((a) => a.id)).toContain('sdd-planner');
  });

  it('shows (missing) when the attachment file was deleted from disk before the model read it', async () => {
    const t = await create({ text: '#steps:10' });
    await data({ cmd: 'thread.send', threadId: t.id, text: 'look', attachments: [png('gone.png', 4)] });
    const dir = path.join(root, '.sdd-studio', 'attachments');
    for (const name of await readdir(dir)) await rm(path.join(dir, name));
    await waitFor(() => turnEnded(t.id));
    expect(deltas(t.id)).toContain('heard: look [attachments: gone.png (missing)]');
  });

  it('closes the connection when a frame exceeds the maximum payload', async () => {
    const closed = new Promise<number>((resolve) => ws.once('close', (code) => resolve(code)));
    ws.send(JSON.stringify({ kind: 'command', id: 'big', cmd: 'thread.send', threadId: 'x', text: 'y'.repeat(MAX_FRAME_BYTES + 1) }));
    expect(await closed).toBe(1009);
  });
});
