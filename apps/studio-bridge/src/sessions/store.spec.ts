import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defaultThreadOptions } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixture } from '../test-utils/fixture';
import { ThreadStore, type StoredThread } from './store';

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => ({ root, cleanup } = await copyFixture()));
afterEach(() => cleanup());

const thread = (over: Partial<StoredThread> = {}): StoredThread => ({
  id: 't1', channelId: 'general', title: 'hola', agent: 'sdd-orchestrator', options: defaultThreadOptions(),
  status: 'idle', createdAt: '2026-10-07T00:00:00.000Z', lastActivity: '2026-10-07T00:00:00.000Z',
  engineSessionId: null, ...over,
});

describe('ThreadStore', () => {
  it('creates a self-ignoring .sdd-studio folder', async () => {
    await new ThreadStore(root).init();
    expect(await readFile(path.join(root, '.sdd-studio/.gitignore'), 'utf8')).toBe('*\n');
  });

  it('persists threads and events across instances', async () => {
    const a = new ThreadStore(root);
    await a.init();
    await a.upsert(thread({ engineSessionId: 'sess-1' }));
    expect(a.append('t1', { type: 'user.message', text: 'hola' })).toBe(0);
    expect(a.append('t1', { type: 'message.end', messageId: 'm' })).toBe(1);
    await a.flush();

    const b = new ThreadStore(root);
    await b.init();
    expect(b.get('t1')?.engineSessionId).toBe('sess-1');
    expect(await b.history('t1', 1)).toEqual([{ seq: 1, event: { type: 'message.end', messageId: 'm' } }]);
    expect(b.append('t1', { type: 'message.end', messageId: 'n' })).toBe(2);
  });

  it('marks busy threads as interrupted after a restart', async () => {
    const a = new ThreadStore(root);
    await a.init();
    await a.upsert(thread({ id: 'r', status: 'running' }));
    await a.upsert(thread({ id: 'w', status: 'waiting-approval' }));
    await a.upsert(thread({ id: 'q', status: 'queued' }));
    await a.flush();
    const b = new ThreadStore(root);
    await b.init();
    expect(b.list().map((t) => [t.id, t.status])).toEqual([['r', 'interrupted'], ['w', 'interrupted'], ['q', 'interrupted']]);
  });

  it('filters by channel and returns [] for unknown thread history', async () => {
    const s = new ThreadStore(root);
    await s.init();
    await s.upsert(thread({ id: 'a', channelId: 'fixes' }));
    await s.upsert(thread({ id: 'b', channelId: 'general' }));
    expect(s.list('fixes').map((t) => t.id)).toEqual(['a']);
    expect(await s.history('../../etc/passwd', 0)).toEqual([]);
  });

  it('keeps the last N bot events per channel', async () => {
    const s = new ThreadStore(root);
    await s.init();
    for (let i = 0; i < 5; i++) {
      s.appendBot({ channelId: 'spec:s1', botKind: 'task.status', payload: { i } });
    }
    expect((await s.botHistory('spec:s1', 2)).map((e) => e.payload.i)).toEqual([3, 4]);
    expect(await s.botHistory('fixes', 10)).toEqual([]);
  });

  it('handles disk errors without crashing on append', async () => {
    const errors: unknown[] = [];
    const s = new ThreadStore(root, (e) => errors.push(e));
    await s.init();
    await s.upsert(thread());
    await rm(path.join(root, '.sdd-studio/threads'), { recursive: true });
    s.append('t1', { type: 'message.end', messageId: 'm' });
    await s.flush();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('recovers from truncated lines and derives seq correctly', async () => {
    const s = new ThreadStore(root);
    await s.init();
    await s.upsert(thread());
    const threadFile = path.join(root, '.sdd-studio/threads/t1.jsonl');
    await writeFile(threadFile, '{"seq":0,"event":{"type":"user.message","text":"first"}}\n{"seq":1,"ev');
    const s2 = new ThreadStore(root);
    await s2.init();
    const nextSeq = s2.append('t1', { type: 'message.end', messageId: 'm' });
    expect(nextSeq).toBe(1);
    await s2.flush();
    const hist = await s2.history('t1', 0);
    expect(hist.map((e) => e.seq)).toEqual([0, 1]);
  });

  it('I1: refuses channel ids that would escape .sdd-studio/channels', async () => {
    const errors: unknown[] = [];
    const s = new ThreadStore(root, (e) => errors.push(e));
    await s.init();
    s.appendBot({ channelId: 'spec:x/../../escaped', botKind: 'task.status', payload: {} } as never);
    await s.flush();
    expect(errors.length).toBeGreaterThan(0);
    expect(await s.botHistory('spec:x/../../escaped', 10)).toEqual([]);
    await expect(readFile(path.join(root, '.sdd-studio', 'escaped.jsonl'), 'utf8')).rejects.toThrow();
    await expect(readFile(path.join(root, 'escaped.jsonl'), 'utf8')).rejects.toThrow();
  });

  it('I3: recoveredThreadIds lists threads that were busy before the restart', async () => {
    const a = new ThreadStore(root);
    await a.init();
    await a.upsert(thread({ id: 'r', status: 'running' }));
    await a.upsert(thread({ id: 'i', status: 'idle' }));
    await a.flush();
    const b = new ThreadStore(root);
    await b.init();
    expect(b.recoveredThreadIds()).toEqual(['r']);
  });

  it('I5: appends do not re-read the thread file (repair happens at init only)', async () => {
    const s = new ThreadStore(root);
    await s.init();
    await s.upsert(thread());
    for (let i = 0; i < 3; i++) s.append('t1', { type: 'message.end', messageId: `m${i}` });
    await s.flush();
    expect((await s.history('t1', 0)).map((e) => e.seq)).toEqual([0, 1, 2]);
  });

  it('I5: a channel file with a truncated last line is repaired once, before the first append', async () => {
    const file = path.join(root, '.sdd-studio/channels/fixes.jsonl');
    const s = new ThreadStore(root);
    await s.init();
    await writeFile(file, '{"channelId":"fixes","botKind":"a","payload":{"i":0}}\n{"channelId":"fix');
    s.appendBot({ channelId: 'fixes', botKind: 'task.status', payload: { i: 1 } });
    s.appendBot({ channelId: 'fixes', botKind: 'task.status', payload: { i: 2 } });
    expect((await s.botHistory('fixes', 10)).map((e) => e.payload.i)).toEqual([0, 1, 2]);
  });
});
