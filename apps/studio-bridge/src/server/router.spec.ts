import { defaultThreadOptions, type ClientCommand } from '@sdd-studio/protocol';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommandRunner } from '../commands/runner';
import { FakeEngine } from '../engine/fake-engine';
import { SessionManager } from '../sessions/session-manager';
import { ThreadStore } from '../sessions/store';
import { copyFixture } from '../test-utils/fixture';
import { loadWorkspaceSnapshot } from '../workspace/snapshot';
import { createHandlers } from './router';

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => ({ root, cleanup } = await copyFixture()));
afterEach(() => cleanup());

async function handlers() {
  const snapshot = (await loadWorkspaceSnapshot(root)).snapshot;
  const store = new ThreadStore(root);
  await store.init();
  const sessions = new SessionManager({ root, engine: new FakeEngine(1), store, snapshot: () => snapshot, broadcast: () => {} });
  return createHandlers({
    root, authMode: 'api-key', bridgeVersion: '0.1.0', sessions, store,
    watcher: { current: () => snapshot }, runner: new CommandRunner(root, () => {}, () => 'run-1'),
  });
}
const cmd = (c: Record<string, unknown>) => ({ kind: 'command', id: 'x', ...c }) as ClientCommand;

describe('createHandlers', () => {
  it('builds the welcome from the snapshot', async () => {
    expect((await handlers()).welcome()).toEqual({
      bridgeVersion: '0.1.0', workspace: { root, project: 'studio fixture' }, kitVersion: '0.16.0', authMode: 'api-key',
    });
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
    const h = await handlers();
    const thread = (await h.handle(cmd({ cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'hola' }))) as { id: string };
    expect(await h.handle(cmd({ cmd: 'thread.list', channelId: 'general' }))).toEqual([expect.objectContaining({ id: thread.id })]);
    // let the background turn finish so it is not still writing to the store when afterEach removes the workspace
    const status = async () => ((await h.handle(cmd({ cmd: 'thread.list', channelId: 'general' }))) as { status: string }[])[0]?.status;
    for (let n = 0; n < 250 && ['queued', 'running'].includes((await status()) ?? ''); n++) await new Promise((r) => setTimeout(r, 20));
    expect(await h.handle(cmd({ cmd: 'command.run', name: 'validate', args: [] }))).toEqual({ runId: 'run-1' });
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
});
