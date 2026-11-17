import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, rmSync, utimesSync, writeFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { hostname, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Entry = { quick?: string[]; full?: string[]; full_exclusive?: boolean };
type Lib = {
  resolveEntryId(config: object, query: string): { id?: string; error?: string; candidates?: string[] };
  shellQuote(value: string, platform: string): string;
  expandFiles(command: string, files: string[], platform: string): string | null;
  selectCycle(
    candidates: { spec: string; cycle: string; status: string; apps: string[] }[],
    query: { app: string; spec?: string; cycle?: string },
  ): { cycle: { cycle: string } | null; reason?: string };
  parseStatusZ(output: string): string[];
  canReuse(
    previous: object,
    input: { app: string; changedSincePrevious: string[] | null; dirtyNow: string[]; prefix: string },
  ): boolean;
  inferEntry(input: object): Entry | null;
  tailOf(text: string, lines?: number): string;
  logicalIdsOf(globalJson: object): string[];
  descendantsOf(pid: number, list: (pid: number) => number[]): number[];
};
type LeaseLib = {
  judgeLease(input: { owner: object | null; ageMs: number; host: string; pidAlive: boolean }): string;
  startHeartbeat(file: string, intervalMs: number): () => void;
  tryAcquire(file: string, info: object, options?: { suspect?: string }): { acquired: boolean; owner?: { pid: number }; suspect?: string };
  releaseLease(file: string): boolean;
  isPidAlive(pid: number): boolean;
  acquireWithWait(file: string, info: object, options: { waitMs: number; pollMs: number }): Promise<{ acquired: boolean }>;
};

const kitRoot = resolve(__dirname, '../../../templates/sdd/scripts/lib');
let lib: Lib;
let lease: LeaseLib;

beforeAll(async () => {
  lib = (await import(pathToFileURL(join(kitRoot, 'verify.mjs')).href)) as Lib;
  lease = (await import(pathToFileURL(join(kitRoot, 'verify-lease.mjs')).href)) as LeaseLib;
});

describe('verify.mjs', () => {
  const config = { 'apps/api': {}, 'libs/api': {}, 'apps/web': {}, $schema: 'x' };

  it('resolves by logical id, by unique bare name and reports ambiguity or absence', () => {
    expect(lib.resolveEntryId(config, 'apps/api')).toEqual({ id: 'apps/api' });
    expect(lib.resolveEntryId(config, 'web')).toEqual({ id: 'apps/web' });
    expect(lib.resolveEntryId(config, 'api').error).toBe('ambiguous');
    expect(lib.resolveEntryId(config, 'nope').error).toBe('missing');
  });

  it('quotes files per platform and escapes embedded quotes', () => {
    expect(lib.shellQuote("a b's.ts", 'linux')).toBe(`'a b'\\''s.ts'`);
    expect(lib.shellQuote('a b.ts', 'win32')).toBe('"a b.ts"');
  });

  it('expands {files} or signals a skip when no files are given', () => {
    expect(lib.expandFiles('jest {files}', ['a.ts', 'b c.ts'], 'linux')).toBe("jest 'a.ts' 'b c.ts'");
    expect(lib.expandFiles('jest {files}', [], 'linux')).toBeNull();
    expect(lib.expandFiles('jest', [], 'linux')).toBe('jest');
  });

  it('selects the single in-progress cycle that lists the app, or the explicit one', () => {
    const cycles = [
      { spec: 'spec-a-001-x', cycle: 'cycle-01', status: 'in-progress', apps: ['apps/api'] },
      { spec: 'spec-a-002-y', cycle: 'cycle-01', status: 'completed', apps: ['apps/api'] },
    ];
    expect(lib.selectCycle(cycles, { app: 'apps/api' }).cycle?.cycle).toBe('cycle-01');
    expect(lib.selectCycle(cycles, { app: 'apps/web' }).reason).toBe('none');
    expect(lib.selectCycle(cycles, { app: 'apps/api', spec: 'y' }).cycle).not.toBeNull();
    expect(lib.selectCycle([...cycles, { ...cycles[0], spec: 'spec-a-003-z' }], { app: 'apps/api' }).reason).toBe('ambiguous');
  });

  it('parses porcelain -z output skipping rename origins', () => {
    expect(lib.parseStatusZ(' M a.ts\0?? b.ts\0R  new.ts\0old.ts\0')).toEqual(['a.ts', 'b.ts', 'new.ts']);
  });

  it('allows reuse only for a green clean full result with just sdd/ changes since', () => {
    const previous = { app: 'apps/api', level: 'full', ok: true, commit: 'abc', dirty: [] };
    const base = { app: 'apps/api', changedSincePrevious: ['sdd/x.md'], dirtyNow: [], prefix: 'sdd/' };
    expect(lib.canReuse(previous, base)).toBe(true);
    expect(lib.canReuse(previous, { ...base, changedSincePrevious: ['src/a.ts'] })).toBe(false);
    expect(lib.canReuse(previous, { ...base, dirtyNow: ['src/a.ts'] })).toBe(false);
    expect(lib.canReuse(previous, { ...base, changedSincePrevious: null })).toBe(false);
    expect(lib.canReuse({ ...previous, dirty: ['x'] }, base)).toBe(false);
    expect(lib.canReuse({ ...previous, commit: null }, base)).toBe(false);
    expect(lib.canReuse({ ...previous, ok: false }, base)).toBe(false);
  });

  it('infers nx, package-script and standalone entries', () => {
    expect(lib.inferEntry({ name: 'api', nx: true, projectTargets: ['test', 'build'] })).toEqual({
      quick: ['pnpm nx run-many -t test -p api'],
      full: ['pnpm nx run-many -t test build -p api'],
      full_exclusive: true,
    });
    expect(lib.inferEntry({ name: 'api', nx: true, projectTargets: null })?.full).toEqual(['pnpm nx run-many -t lint test build -p api']);
    expect(
      lib.inferEntry({ name: 'cli', nx: false, hasDir: true, packageJson: { name: '@s/cli', scripts: { test: 'x', build: 'y' } } }),
    ).toEqual({ quick: ['pnpm --filter @s/cli run test'], full: ['pnpm --filter @s/cli run test', 'pnpm --filter @s/cli run build'] });
    expect(lib.inferEntry({ name: 'app', nx: false, hasDir: false, rootPackageJson: { scripts: { lint: 'x' } } })).toEqual({
      quick: ['pnpm run lint'],
      full: ['pnpm run lint'],
    });
    expect(lib.inferEntry({ name: 'app', nx: false, hasDir: false, rootPackageJson: {} })).toBeNull();
  });

  it('collects descendants children-first', () => {
    const tree: Record<number, number[]> = { 1: [2, 3], 2: [4] };
    expect(lib.descendantsOf(1, (pid) => tree[pid] ?? [])).toEqual([4, 2, 3]);
  });

  it('keeps the last lines and maps global.json to logical ids', () => {
    expect(lib.tailOf('1\n2\n3\n', 2)).toBe('2\n3');
    expect(lib.logicalIdsOf({ monorepo: { apps: { a: '' }, libs: { l: '' } } })).toEqual(['apps/a', 'libs/l']);
  });
});

describe('verify-lease.mjs', () => {
  const tempFile = () => join(mkdtempSync(join(tmpdir(), 'lease-')), 'verify-full.lock');

  it('acquires once, reports the live owner to a second taker and releases', () => {
    const file = tempFile();
    expect(lease.tryAcquire(file, { app: 'apps/a' }).acquired).toBe(true);
    const second = lease.tryAcquire(file, { app: 'apps/b' });
    expect(second.acquired).toBe(false);
    expect(second.owner?.pid).toBe(process.pid);
    expect(lease.releaseLease(file)).toBe(true);
    expect(lease.tryAcquire(file, {}).acquired).toBe(true);
    rmSync(file, { force: true });
  });

  it('takes a lease whose owner pid is dead', () => {
    const file = tempFile();
    const dead = spawnSync(process.execPath, ['-e', '0']).pid as number;
    writeFileSync(file, JSON.stringify({ pid: dead, host: hostname(), repo: '/x' }));
    expect(lease.isPidAlive(dead)).toBe(false);
    expect(lease.tryAcquire(file, {}).acquired).toBe(true);
    rmSync(file, { force: true });
  });

  it('times out waiting for a live owner', async () => {
    const file = tempFile();
    lease.tryAcquire(file, {});
    const outcome = await lease.acquireWithWait(file, {}, { waitMs: 150, pollMs: 50 });
    expect(outcome.acquired).toBe(false);
    rmSync(file, { force: true });
  });

  it('judges every liveness branch', () => {
    const me = 'host-a';
    const judge = (owner: object | null, ageMs: number, host: string, pidAlive: boolean) => lease.judgeLease({ owner, ageMs, host, pidAlive });
    expect(judge({ pid: 1, host: me }, 1000, me, false)).toBe('dead');
    expect(judge({ pid: 1, host: me }, 1000, me, true)).toBe('live');
    expect(judge({ pid: 1, host: me }, 91000, me, true)).toBe('stale-heartbeat');
    expect(judge({ pid: 1, host: 'other' }, 1000, me, false)).toBe('live');
    expect(judge({ pid: 1, host: 'other' }, 91000, me, true)).toBe('stale-heartbeat');
    expect(judge({ pid: 1 }, 1000, me, false)).toBe('live');
    expect(judge({ pid: 1 }, 91000, me, false)).toBe('stale-heartbeat');
    expect(judge(null, 1000, me, false)).toBe('live');
    expect(judge(null, 6000, me, false)).toBe('stale-heartbeat');
  });

  it('takes a heartbeat-stale lease only after two consecutive polls that saw it unchanged', () => {
    const file = tempFile();
    writeFileSync(file, JSON.stringify({ pid: process.pid, host: hostname(), started_at: 't' }));
    const old = new Date(Date.now() - 120000);
    utimesSync(file, old, old);
    const first = lease.tryAcquire(file, {});
    expect(first.acquired).toBe(false);
    expect(first.suspect).toBeTruthy();
    const second = lease.tryAcquire(file, {}, { suspect: first.suspect });
    expect(second.acquired).toBe(true);
    rmSync(file, { force: true });
  });

  it('does not take the lease when the holder refreshed it between polls', () => {
    const file = tempFile();
    writeFileSync(file, JSON.stringify({ pid: process.pid, host: hostname(), started_at: 't' }));
    const old = new Date(Date.now() - 120000);
    utimesSync(file, old, old);
    const first = lease.tryAcquire(file, {});
    const now = new Date();
    utimesSync(file, now, now);
    expect(lease.tryAcquire(file, {}, { suspect: first.suspect }).acquired).toBe(false);
    rmSync(file, { force: true });
  });

  it('keeps a lease held by another host alive while its heartbeat is fresh', () => {
    const file = tempFile();
    writeFileSync(file, JSON.stringify({ pid: 999999, host: 'some-other-host' }));
    expect(lease.tryAcquire(file, {}).acquired).toBe(false);
    rmSync(file, { force: true });
  });

  it('refreshes the file mtime while the heartbeat runs and stops afterwards', async () => {
    const file = tempFile();
    writeFileSync(file, '{}');
    const old = new Date(Date.now() - 60000);
    utimesSync(file, old, old);
    const stop = lease.startHeartbeat(file, 20);
    await new Promise((r) => setTimeout(r, 120));
    stop();
    const refreshed = statSync(file).mtimeMs;
    expect(Date.now() - refreshed).toBeLessThan(5000);
    utimesSync(file, old, old);
    await new Promise((r) => setTimeout(r, 80));
    expect(Date.now() - statSync(file).mtimeMs).toBeGreaterThan(50000);
    rmSync(file, { force: true });
  });
});
