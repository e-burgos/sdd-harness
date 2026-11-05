import { writeFile } from 'node:fs/promises';
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
});
