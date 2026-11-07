import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ServerMessage } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthState } from '../auth-mode';
import { copyFixture, waitFor } from '../test-utils/fixture';
import { openProjectRuntime } from './runtime';

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => {
  ({ root, cleanup } = await copyFixture());
});
afterEach(() => cleanup());

describe('openProjectRuntime', () => {
  it('counts a running kit command as busy and kills it on close', async () => {
    await writeFile(path.join(root, 'sdd', 'scripts', 'spec-gate.mjs'), "process.stdout.write('up\\n'); setInterval(() => undefined, 1000);\n");
    const sent: ServerMessage[] = [];
    const runtime = await openProjectRuntime(root, {
      engine: 'fake',
      auth: new AuthState({}),
      login: { status: async () => ({ loggedIn: false }), login: async () => undefined, logout: async () => undefined } as never,
      bridgeVersion: '0.0.0',
      broadcast: (message) => sent.push(message),
    });
    expect(runtime.isBusy()).toBe(false);
    await runtime.handle({ kind: 'command', id: 'c1', cmd: 'command.run', name: 'gate', args: [] });
    expect(runtime.isBusy()).toBe(true);
    await waitFor(() => sent.some((m) => m.kind === 'command.output'));
    await runtime.close();
    await waitFor(() => sent.some((m) => m.kind === 'command.exit'));
    expect(runtime.isBusy()).toBe(false);
  });

  it('puts the GitHub remote in the snapshot clients get', async () => {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/octo/repo.git'], { cwd: root });
    await mkdir(path.join(root, 'sdd', 'scripts', 'lib'), { recursive: true });
    await writeFile(
      path.join(root, 'sdd', 'scripts', 'lib', 'github.mjs'),
      "export const branchNameFor = (s, c) => 'feat/' + s + '-' + c;\nexport const parseRemoteUrl = (u) => { const m = /github\\.com\\/([^/]+)\\/([^/.]+)/.exec(u); return m ? { owner: m[1], name: m[2] } : null; };\n",
    );
    const sent: ServerMessage[] = [];
    const runtime = await openProjectRuntime(root, {
      engine: 'fake',
      auth: new AuthState({}),
      login: { status: async () => ({ loggedIn: false }), login: async () => undefined, logout: async () => undefined } as never,
      bridgeVersion: '0.0.0',
      broadcast: (message) => sent.push(message),
    });
    try {
      await waitFor(() => sent.some((m) => m.kind === 'workspace.changed' && m.snapshot.github?.remote?.owner === 'octo'));
      const snapshot = (await runtime.handle({ kind: 'command', id: 's1', cmd: 'workspace.snapshot' })) as { github?: { remote: { name: string } } };
      expect(snapshot.github?.remote.name).toBe('repo');
    } finally {
      await runtime.close();
    }
  });
});
