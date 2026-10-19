import type { ServerEvent } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixture, waitFor } from '../test-utils/fixture';
import { CommandRunner } from './runner';

let root: string;
let cleanup: () => Promise<void>;
let sent: ServerEvent[];
beforeEach(async () => {
  ({ root, cleanup } = await copyFixture());
  sent = [];
});
afterEach(() => cleanup());

const exitOf = (runId: string) =>
  sent.find((e): e is Extract<ServerEvent, { kind: 'command.exit' }> => e.kind === 'command.exit' && e.runId === runId);
const outputOf = (runId: string, stream: 'stdout' | 'stderr') =>
  sent.flatMap((e) => (e.kind === 'command.output' && e.runId === runId && e.stream === stream ? [e.chunk] : [])).join('');

describe('CommandRunner', () => {
  it('runs the gate script with its args and streams stdout', async () => {
    const runner = new CommandRunner(root, (e) => sent.push(e), () => 'r1');
    expect(runner.run('gate', ['spec-dev-001-pagos', 'cycle-01'])).toBe('r1');
    expect((await waitFor(() => exitOf('r1'))).exitCode).toBe(0);
    expect(outputOf('r1', 'stdout')).toContain('gate spec-dev-001-pagos cycle-01');
  });

  it('reports a non-zero exit and stderr', async () => {
    const runner = new CommandRunner(root, (e) => sent.push(e), () => 'r2');
    runner.run('gate', ['blocked']);
    expect((await waitFor(() => exitOf('r2'))).exitCode).toBe(1);
    expect(outputOf('r2', 'stderr')).toContain('blocked');
  });

  it('fails cleanly when the script is missing', async () => {
    const runner = new CommandRunner(root, (e) => sent.push(e), () => 'r3');
    runner.run('rebuild-catalog', []);
    expect((await waitFor(() => exitOf('r3'))).exitCode).not.toBe(0);
    expect(sent.filter((e) => e.kind === 'command.exit')).toHaveLength(1);
  });

  it('decodes multi-byte output split across chunks', async () => {
    const runner = new CommandRunner(root, (e) => sent.push(e), () => 'r4');
    runner.run('rebuild-tasks-index', []);
    await waitFor(() => exitOf('r4'));
    expect(outputOf('r4', 'stdout')).toBe('ñandú ✓\n');
  });
});
