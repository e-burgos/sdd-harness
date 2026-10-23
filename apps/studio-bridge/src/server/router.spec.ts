import { AuthState } from '../auth-mode';
import { decodeClientMessage, defaultThreadOptions, type ClientCommand, type ServerEvent } from '@sdd-studio/protocol';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommandRunner } from '../commands/runner';
import { FakeEngine } from '../engine/fake-engine';
import { SessionManager } from '../sessions/session-manager';
import { ThreadStore } from '../sessions/store';
import { copyFixture, waitFor } from '../test-utils/fixture';
import { loadWorkspaceSnapshot } from '../workspace/snapshot';
import { createHandlers } from './router';

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => ({ root, cleanup } = await copyFixture()));
afterEach(() => cleanup());

async function handlers(broadcast: (e: ServerEvent) => void = () => {}) {
  const snapshot = (await loadWorkspaceSnapshot(root)).snapshot;
  const store = new ThreadStore(root);
  await store.init();
  const sessions = new SessionManager({ root, engine: new FakeEngine(1), store, snapshot: () => snapshot, broadcast: () => {} });
  const auth = new AuthState({}, 'sdd-studio/test');
  return createHandlers({
    root, auth, bridgeVersion: '0.1.0', sessions, store,
    watcher: { current: () => snapshot }, runner: new CommandRunner(root, broadcast, () => 'run-1'),
  });
}
const cmd = (c: Record<string, unknown>): ClientCommand => {
  const parsed = decodeClientMessage(JSON.stringify({ kind: 'command', id: 'x', ...c }));
  if (!parsed.ok || parsed.value.kind !== 'command') throw new Error(`invalid command in test: ${JSON.stringify(c)}`);
  return parsed.value;
};

describe('createHandlers', () => {
  it('builds the welcome from the snapshot', async () => {
    expect((await handlers()).welcome()).toEqual({
      bridgeVersion: '0.1.0', workspace: { root, project: 'studio fixture' }, kitVersion: '0.16.0', authMode: 'local-claude-login',
      features: ['pending-messages', 'thread-link', 'always-rules'],
    });
  });

  it('auth.set switches the welcome to api-key and null goes back', async () => {
    const h = await handlers();
    expect(await h.handle(cmd({ cmd: 'auth.set', apiKey: 'sk-ant-' + 'x'.repeat(30) }))).toEqual({ authMode: 'api-key' });
    expect(h.welcome().authMode).toBe('api-key');
    expect(await h.handle(cmd({ cmd: 'auth.set', apiKey: null }))).toEqual({ authMode: 'local-claude-login' });
  });

  it('reads files under sdd/ and refuses the rest', async () => {
    const h = await handlers();
    expect(await h.handle(cmd({ cmd: 'workspace.readFile', path: 'sdd/global.json' }))).toMatchObject({ path: 'sdd/global.json' });
    await expect(h.handle(cmd({ cmd: 'workspace.readFile', path: 'sdd/../package.json' }))).rejects.toMatchObject({ code: 'bad-path' });
  });

  it('rejects oversized files and directories as bad-request', async () => {
    const h = await handlers();
    await writeFile(path.join(root, 'sdd', 'big.md'), 'x'.repeat(2 * 1024 * 1024 + 1));
    await expect(h.handle(cmd({ cmd: 'workspace.readFile', path: 'sdd/big.md' }))).rejects.toMatchObject({ code: 'bad-request' });
    await expect(h.handle(cmd({ cmd: 'workspace.readFile', path: 'sdd/scripts' }))).rejects.toMatchObject({ code: 'bad-request' });
  });

  it('creates threads, lists them and runs kit commands', async () => {
    const events: ServerEvent[] = [];
    const h = await handlers((e) => events.push(e));
    const thread = (await h.handle(cmd({ cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'hola' }))) as { id: string };
    expect(await h.handle(cmd({ cmd: 'thread.list', channelId: 'general' }))).toEqual([expect.objectContaining({ id: thread.id })]);
    // let the background turn finish so it is not still writing to the store when afterEach removes the workspace
    const status = async () => ((await h.handle(cmd({ cmd: 'thread.list', channelId: 'general' }))) as { status: string }[])[0]?.status;
    for (let n = 0; n < 250 && ['queued', 'running'].includes((await status()) ?? ''); n++) await new Promise((r) => setTimeout(r, 20));
    expect(await h.handle(cmd({ cmd: 'command.run', name: 'validate', args: [] }))).toEqual({ runId: 'run-1' });
    // the kit script runs with the workspace as cwd: Windows can't remove it until the child exits
    await waitFor(() => events.some((e) => e.kind === 'command.exit' && e.runId === 'run-1'));
    expect(await h.handle(cmd({ cmd: 'channel.botHistory', channelId: 'fixes', limit: 10 }))).toEqual([]);
  });

  it('I4: presence.get returns the current presence', async () => {
    const h = await handlers();
    const presence = (await h.handle(cmd({ cmd: 'presence.get' }))) as { agent: string; state: string }[];
    expect(presence.map((p) => p.agent)).toEqual(['sdd-orchestrator', 'sdd-planner']);
    expect(presence.every((p) => p.state === 'idle')).toBe(true);
  });

  it.skipIf(process.platform === 'win32')('T16: a FIFO under sdd/ is refused without blocking', async () => {
    const { execFileSync } = await import('node:child_process');
    const fifo = path.join(root, 'sdd', 'pipe.md');
    execFileSync('mkfifo', [fifo]);
    const h = await handlers();
    await expect(h.handle(cmd({ cmd: 'workspace.readFile', path: 'sdd/pipe.md' }))).rejects.toMatchObject({ code: 'bad-request' });
  }, 5000);

  describe('pending messages and cycle-02 contracts', () => {
    const create = async (h: Awaited<ReturnType<typeof handlers>>, text: string) => {
      const thread = (await h.handle(cmd({ cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text }))) as { id: string };
      const list = async () => ((await h.handle(cmd({ cmd: 'thread.list', channelId: 'general' }))) as { status: string; pendingCount: number }[])[0];
      await waitFor(async () => (await list())?.status === 'running');
      return { id: thread.id, list };
    };

    it('thread.send answers started or pending, and the pending commands work end to end', async () => {
      const h = await handlers();
      const { id, list } = await create(h, '#slow');
      const sent = (await h.handle(cmd({ cmd: 'thread.send', threadId: id, text: 'later' }))) as { delivery: string; pendingId: string };
      expect(sent).toEqual({ delivery: 'pending', pendingId: expect.any(String) });
      expect(await h.handle(cmd({ cmd: 'thread.pending.edit', threadId: id, pendingId: sent.pendingId, text: 'edited' }))).toBeNull();
      await expect(h.handle(cmd({ cmd: 'thread.pending.flush', threadId: id }))).rejects.toMatchObject({ code: 'conflict' });
      expect(await h.handle(cmd({ cmd: 'thread.pending.remove', threadId: id, pendingId: sent.pendingId }))).toBeNull();
      expect((await list())?.pendingCount).toBe(0);
      await expect(h.handle(cmd({ cmd: 'thread.pending.remove', threadId: id, pendingId: sent.pendingId }))).rejects.toMatchObject({ code: 'not-found' });
      await h.handle(cmd({ cmd: 'thread.interrupt', threadId: id }));
    });

    it('thread.pending.flush starts a turn with the pending messages of a stopped thread', async () => {
      const h = await handlers();
      const { id, list } = await create(h, '#slow');
      await h.handle(cmd({ cmd: 'thread.send', threadId: id, text: 'p1' }));
      await h.handle(cmd({ cmd: 'thread.interrupt', threadId: id }));
      await waitFor(async () => (await list())?.status === 'interrupted');
      await new Promise((r) => setTimeout(r, 30));
      expect(await h.handle(cmd({ cmd: 'thread.pending.flush', threadId: id }))).toEqual({ delivery: 'started' });
      await waitFor(async () => (await list())?.status === 'idle');
    });

    it.each([
      ['thread.create with attachments', { cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'x', attachments: [{ kind: 'text', name: 'a.txt', mime: 'text/plain', text: 'hi' }] }, 'unsupported: attachments'],
      ['thread.create with agent refs', { cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'x', refs: { agents: ['sdd-planner'], skills: [] } }, 'unsupported: catalog'],
      ['thread.send with attachments', { cmd: 'thread.send', threadId: 't', text: 'x', attachments: [{ kind: 'text', name: 'a.txt', mime: 'text/plain', text: 'hi' }] }, 'unsupported: attachments'],
      ['workspace.searchFiles', { cmd: 'workspace.searchFiles', query: 'a', limit: 5 }, 'unsupported: file-search'],
      ['attachment.get', { cmd: 'attachment.get', sha256: 'a'.repeat(64), mime: 'image/png' }, 'unsupported: attachments'],
    ])('%s answers bad-request %#', async (_name, body, message) => {
      const h = await handlers();
      await expect(h.handle(cmd(body))).rejects.toMatchObject({ code: 'bad-request', message });
    });

    it('does not announce the cycle-02 features', async () => {
      const features = (await handlers()).welcome().features ?? [];
      expect(features).not.toContain('attachments');
      expect(features).not.toContain('file-search');
      expect(features).not.toContain('catalog');
    });
  });

  it('thread.create accepts a link and thread.setLink answers the updated ThreadInfo', async () => {
    const h = await handlers();
    const created = (await h.handle(cmd({ cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'hola', link: { kind: 'none' } }))) as { id: string; link: unknown };
    expect(created.link).toEqual({ target: { kind: 'none' }, source: 'manual' });
    const updated = (await h.handle(cmd({ cmd: 'thread.setLink', threadId: created.id, link: { kind: 'fix', fixId: 'FIX-dev-001-001' } }))) as { link: unknown };
    expect(updated.link).toEqual({ target: { kind: 'fix', fixId: 'FIX-dev-001-001' }, source: 'manual' });
    await expect(h.handle(cmd({ cmd: 'thread.setLink', threadId: created.id, link: { kind: 'fix', fixId: 'FIX-nope' } }))).rejects.toMatchObject({ code: 'not-found' });
    await waitFor(async () => ((await h.handle(cmd({ cmd: 'thread.list' }))) as { status: string }[])[0]?.status === 'idle');
  });
});
