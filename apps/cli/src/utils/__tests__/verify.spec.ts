import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { hostname, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Entry = { quick?: string[]; full?: string[]; full_exclusive?: boolean };
type Lib = {
  resolveEntryId(config: object, query: string): { id?: string; error?: string; candidates?: string[] };
  shellQuote(value: string, platform: string): string;
  expandFiles(command: string, files: string[], platform: string): string | null;
  unsafeFileName(files: string[], platform: string): string | null;
  appDirName(app: string): string;
  allSkipped(commands: { skipped?: boolean }[]): boolean;
  selectCycle(
    candidates: { spec: string; cycle: string; status: string; apps: string[] }[],
    query: { app: string; spec?: string; cycle?: string },
  ): { cycle: { cycle: string } | null; reason?: string; candidates?: string[] };
  parseStatusZ(output: string): string[];
  canReuse(
    previous: object,
    input: { app: string; changedSincePrevious: string[] | null; dirtyNow: string[]; prefix: string; commands?: string[] },
  ): boolean;
  inferEntry(input: object): Entry | null;
  whyNoEntry(input: object): string;
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
    const previous = { app: 'apps/api', level: 'full', ok: true, commit: 'abc', dirty: [], commands: [{ command: 'pnpm test', skipped: false }] };
    const base = { app: 'apps/api', changedSincePrevious: ['sdd/x.md'], dirtyNow: [], prefix: 'sdd/', commands: ['pnpm test'] };
    expect(lib.canReuse(previous, base)).toBe(true);
    expect(lib.canReuse(previous, { ...base, changedSincePrevious: ['src/a.ts'] })).toBe(false);
    expect(lib.canReuse(previous, { ...base, dirtyNow: ['src/a.ts'] })).toBe(false);
    expect(lib.canReuse(previous, { ...base, changedSincePrevious: null })).toBe(false);
    expect(lib.canReuse({ ...previous, dirty: ['x'] }, base)).toBe(false);
    expect(lib.canReuse({ ...previous, commit: null }, base)).toBe(false);
    expect(lib.canReuse({ ...previous, ok: false }, base)).toBe(false);
  });

  it('refuses reuse when the stored commands differ from the ones the level would run now', () => {
    const previous = { app: 'apps/api', level: 'full', ok: true, commit: 'abc', dirty: [], commands: [{ command: 'a' }, { command: 'b' }] };
    const base = { app: 'apps/api', changedSincePrevious: [], dirtyNow: [], prefix: 'sdd/', commands: ['a', 'b'] };
    expect(lib.canReuse(previous, base)).toBe(true);
    expect(lib.canReuse(previous, { ...base, commands: ['b', 'a'] })).toBe(false);
    expect(lib.canReuse(previous, { ...base, commands: ['a'] })).toBe(false);
    expect(lib.canReuse(previous, { ...base, commands: ['a', 'b', 'c'] })).toBe(false);
    expect(lib.canReuse({ ...previous, commands: [{ command: 'a' }, { command: 'b', skipped: true }] }, base)).toBe(false);
    expect(lib.canReuse({ ...previous, commands: undefined }, base)).toBe(false);
  });

  it('names the per-subproject result folder and detects an all-skipped run', () => {
    expect(lib.appDirName('apps/billing-api')).toBe('apps-billing-api');
    expect(lib.allSkipped([{ skipped: true }, { skipped: true }])).toBe(true);
    expect(lib.allSkipped([{ skipped: true }, { skipped: false }])).toBe(false);
    expect(lib.allSkipped([])).toBe(false);
  });

  it('prefixes dash-leading file names with ./ and rejects cmd.exe-hostile names on win32 only', () => {
    expect(lib.expandFiles('t {files}', ['-rf', 'a.ts'], 'linux')).toBe("t './-rf' 'a.ts'");
    expect(lib.unsafeFileName(['ok.ts', 'a&b.ts'], 'win32')).toBe('a&b.ts');
    for (const bad of ['a"b', 'a%b', 'a^b', 'a|b', 'a<b', 'a>b', 'a!b']) expect(lib.unsafeFileName([bad], 'win32')).toBe(bad);
    expect(lib.unsafeFileName(['a&b.ts'], 'linux')).toBeNull();
  });

  it('lists the candidates of an ambiguous spec match', () => {
    const cycle = { spec: 'spec-a-001-orders', cycle: 'cycle-01', status: 'in-progress', apps: ['apps/api'] };
    const found = lib.selectCycle([cycle, { ...cycle, spec: 'spec-a-002-orders-v2' }], { app: 'apps/api', spec: 'orders' });
    expect(found.reason).toBe('ambiguous');
    expect(found.candidates).toEqual(['spec-a-001-orders/cycle-01', 'spec-a-002-orders-v2/cycle-01']);
  });

  it('writes the full nx command for every nx project that has project.json or package.json', () => {
    const expected = {
      quick: ['pnpm nx run-many -t lint test -p api'],
      full: ['pnpm nx run-many -t lint test build -p api'],
      full_exclusive: true,
    };
    expect(lib.inferEntry({ id: 'apps/api', name: 'api', nx: true, hasProjectJson: true })).toEqual(expected);
    expect(lib.inferEntry({ id: 'apps/api', name: 'api', nx: true, hasProjectJson: false, packageJson: { name: 'x' } })).toEqual(expected);
  });

  it('writes no entry for an nx id without project.json or package.json and says why', () => {
    const facts = { id: 'tools/ghost', name: 'ghost', nx: true, hasProjectJson: false, hasDir: false };
    expect(lib.inferEntry(facts)).toBeNull();
    expect(lib.whyNoEntry(facts)).toBe('not an nx project yet (no project.json or package.json) — run pnpm sdd:verify --init again once it has code');
  });

  it('infers package scripts without nx and falls back to the root scripts only for standalone apps', () => {
    expect(
      lib.inferEntry({ id: 'apps/cli', name: 'cli', nx: false, hasDir: true, packageJson: { name: '@s/cli', scripts: { test: 'x', build: 'y' } } }),
    ).toEqual({ quick: ['pnpm --filter @s/cli run test'], full: ['pnpm --filter @s/cli run test', 'pnpm --filter @s/cli run build'] });
    const root = { scripts: { lint: 'x' } };
    expect(lib.inferEntry({ id: 'apps/app', name: 'app', nx: false, hasDir: false, standalone: true, rootPackageJson: root })).toEqual({
      quick: ['pnpm run lint'],
      full: ['pnpm run lint'],
    });
    const libFacts = { id: 'libs/shared', name: 'shared', nx: false, hasDir: false, standalone: true, rootPackageJson: root };
    expect(lib.inferEntry(libFacts)).toBeNull();
    expect(lib.whyNoEntry(libFacts)).toContain('no directory of its own in a standalone repo');
    expect(lib.inferEntry({ id: 'apps/app', name: 'app', nx: false, hasDir: false, standalone: false, rootPackageJson: root })).toBeNull();
  });

  it('writes no entry for a package.json without any of lint, typecheck, test or build and names them', () => {
    const facts = { id: 'apps/x', name: 'x', nx: false, hasDir: true, packageJson: { name: '@s/x', scripts: { start: 'node .' } } };
    expect(lib.inferEntry(facts)).toBeNull();
    expect(lib.whyNoEntry(facts)).toContain('no lint, typecheck, test or build script in its package.json');
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

  it('releases only a lease whose readable owner is this process on this host', () => {
    const file = tempFile();
    writeFileSync(file, '');
    expect(lease.releaseLease(file)).toBe(false);
    expect(existsSync(file)).toBe(true);
    writeFileSync(file, '{not json');
    expect(lease.releaseLease(file)).toBe(false);
    expect(existsSync(file)).toBe(true);
    writeFileSync(file, JSON.stringify({ pid: process.pid, host: 'another-host' }));
    expect(lease.releaseLease(file)).toBe(false);
    expect(existsSync(file)).toBe(true);
    writeFileSync(file, JSON.stringify({ pid: process.pid, host: hostname() }));
    expect(lease.releaseLease(file)).toBe(true);
    expect(existsSync(file)).toBe(false);
  });

  it('takes a heartbeat-stale lease even with a zero --wait by confirming once past the deadline', async () => {
    const file = tempFile();
    writeFileSync(file, JSON.stringify({ pid: 999999, host: 'some-other-host', started_at: 't' }));
    const old = new Date(Date.now() - 120000);
    utimesSync(file, old, old);
    const outcome = await lease.acquireWithWait(file, {}, { waitMs: 0, pollMs: 40 });
    expect(outcome.acquired).toBe(true);
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
