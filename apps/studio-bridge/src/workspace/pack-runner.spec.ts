import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { KitPackStats } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PackStatsError, createPackRunner, readPackStats, type PackRunResult, type PackRunner } from './pack-runner';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'pack-runner-'));
  const dir = path.join(root, 'sdd/specs/s-1/cycles/cycle-01');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'cycle.json'), JSON.stringify({ apps: ['apps/a', 'apps/b'] }));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const fake = (result: PackRunResult) => {
  const calls: Array<{ args: string[]; timeoutMs: number }> = [];
  const run: PackRunner = async (args, timeoutMs) => {
    calls.push({ args, timeoutMs });
    return result;
  };
  return { run, calls };
};

const raw = {
  rows: [{ role: 'implementor-back', unit: 'B-01', pack_bytes: 100, source_bytes: 400, reason: 'ok' }],
  total: { pack_bytes: 100, source_bytes: 400 },
  pack_misses: [{ path: 'a.md', count: 2 }, { path: 'b.md', count: 1 }],
};

describe('readPackStats', () => {
  it('runs --stats --json with the first cycle app and maps snake_case to camelCase', async () => {
    const { run, calls } = fake({ code: 0, stdout: JSON.stringify(raw) });
    const stats = await readPackStats(root, 's-1', 'cycle-01', run);
    expect(calls).toEqual([{ args: ['s-1', 'cycle-01', '--stats', '--json', '--app', 'apps/a'], timeoutMs: 30_000 }]);
    expect(stats).toEqual({ rows: [{ unit: 'B-01', role: 'implementor-back', packBytes: 100, sourceBytes: 400 }], total: { packBytes: 100, sourceBytes: 400 }, packMisses: 2 });
    expect(KitPackStats.safeParse(stats).success).toBe(true);
  });

  it('omits --app when the cycle has none', async () => {
    const { run, calls } = fake({ code: 0, stdout: JSON.stringify(raw) });
    await readPackStats(root, 's-1', 'cycle-09', run);
    expect(calls[0]?.args).toEqual(['s-1', 'cycle-09', '--stats', '--json']);
  });

  it('answers empty stats on exit 3', async () => {
    const stats = await readPackStats(root, 's-1', 'cycle-01', fake({ code: 3, stdout: '' }).run);
    expect(stats).toEqual({ rows: [], total: { packBytes: 0, sourceBytes: 0 }, packMisses: 0 });
  });

  it('types the other failures', async () => {
    await expect(readPackStats(root, 's-1', 'cycle-01', fake({ code: 2, stdout: '' }).run)).rejects.toMatchObject({ code: 'not-found' });
    await expect(readPackStats(root, 's-1', 'cycle-01', fake({ code: -1, stdout: '' }).run)).rejects.toBeInstanceOf(PackStatsError);
    await expect(readPackStats(root, 's-1', 'cycle-01', fake({ code: 0, stdout: 'nope' }).run)).rejects.toMatchObject({ code: 'conflict' });
  });
});

describe('createPackRunner', () => {
  it('reports the exit code of the script and -1 when it cannot run', async () => {
    const script = path.join(root, 'sdd/scripts');
    await mkdir(script, { recursive: true });
    await writeFile(path.join(script, 'sdd-pack.mjs'), 'process.stdout.write(process.argv.slice(2).join(","));\nprocess.exit(process.argv.includes("fail") ? 3 : 0);\n');
    const run = createPackRunner(root);
    expect(await run(['a', 'b'], 5_000)).toEqual({ code: 0, stdout: 'a,b' });
    expect(await run(['fail'], 5_000)).toEqual({ code: 3, stdout: '' });
    await writeFile(path.join(script, 'sdd-pack.mjs'), 'setTimeout(() => {}, 10_000);\n');
    expect((await run([], 200)).code).toBe(-1);
  });
});
