import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionBindings, sessionIdOfThread, TOUCH_INTERVAL_MS, type RegistryUnit } from './session-bindings';

const KIT_REGISTRY = fileURLToPath(new URL('../../../cli/templates/sdd/scripts/lib/session-registry.mjs', import.meta.url));

const cycleA: RegistryUnit = { kind: 'cycle', spec: 'spec-a-001', cycle: 'cycle-01' };
const cycleB: RegistryUnit = { kind: 'cycle', spec: 'spec-b-002', cycle: 'cycle-01' };
const fixX: RegistryUnit = { kind: 'fix', fix: 'FIX-001' };

let root: string;
let clock: number;
const NOW = Date.parse('2026-11-06T12:00:00.000Z');

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'sdd bindings '));
  await mkdir(path.join(root, '.git'));
  await writeFile(path.join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  clock = NOW;
});
afterEach(() => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

async function installRegistry(): Promise<void> {
  await mkdir(path.join(root, 'sdd', 'scripts', 'lib'), { recursive: true });
  await cp(KIT_REGISTRY, path.join(root, 'sdd', 'scripts', 'lib', 'session-registry.mjs'));
}

const load = (onChange?: () => void) => SessionBindings.load(root, { now: () => clock, onChange });
const sessionFiles = async () => readdir(path.join(root, '.git', 'sdd-sessions', 'sessions')).catch(() => [] as string[]);

describe('SessionBindings', () => {
  it('is unavailable when the opened repo has an older kit without the registry', async () => {
    expect(await load()).toBeNull();
  });

  it('is unavailable when the registry module fails to load', async () => {
    await mkdir(path.join(root, 'sdd', 'scripts', 'lib'), { recursive: true });
    await writeFile(path.join(root, 'sdd', 'scripts', 'lib', 'session-registry.mjs'), 'throw new Error("broken");\n');
    expect(await load()).toBeNull();
  });

  it('derives a registry-safe session id from a thread id', () => {
    expect(sessionIdOfThread('3f2a-uuid')).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(sessionIdOfThread('a/b c')).toBe('studio-a-b-c');
  });

  it('writes, lists and ends the binding of a thread as a studio session', async () => {
    await installRegistry();
    const changes: number[] = [];
    const bindings = (await load(() => changes.push(1)))!;
    bindings.sync('t1', cycleA);
    bindings.sync('t2', fixX);
    await bindings.endAll().then(() => bindings.sync('t3', cycleB));
    await bindings.endAll();
    expect((await sessionFiles()).sort()).toEqual(['studio-t1.json', 'studio-t2.json', 'studio-t3.json']);
    const written = JSON.parse(await readFile(path.join(root, '.git', 'sdd-sessions', 'sessions', 'studio-t1.json'), 'utf8'));
    expect(written).toMatchObject({ session_id: 'studio-t1', unit: cycleA, harness: 'studio', source: 'studio' });
    expect(written.ended_at).not.toBeNull();
    expect(await bindings.listLive()).toEqual([]);
    expect(changes.length).toBeGreaterThan(0);
  });

  it('lists live bindings in protocol shape until they end', async () => {
    await installRegistry();
    const bindings = (await load())!;
    bindings.sync('t1', cycleA);
    bindings.sync('t2', fixX);
    await bindings.listLive();
    const live = await bindings.listLive();
    expect(live.map((b) => [b.sessionId, b.unit, b.harness])).toEqual([
      ['studio-t1', { kind: 'cycle', specId: 'spec-a-001', cycle: 'cycle-01' }, 'studio'],
      ['studio-t2', { kind: 'fix', fixId: 'FIX-001' }, 'studio'],
    ]);
    bindings.end('t1');
    await bindings.endAll().then(() => undefined);
    expect(await bindings.listLive()).toEqual([]);
  });

  it('ends the binding when the thread loses its unit and refreshes it on a unit change', async () => {
    await installRegistry();
    const bindings = (await load())!;
    bindings.sync('t1', cycleA);
    bindings.sync('t1', cycleB);
    bindings.sync('t1', null);
    expect(bindings.has('t1')).toBe(false);
    await bindings.endAll();
    const written = JSON.parse(await readFile(path.join(root, '.git', 'sdd-sessions', 'sessions', 'studio-t1.json'), 'utf8'));
    expect(written.unit).toEqual(cycleB);
    expect(written.ended_at).not.toBeNull();
  });

  it('throttles touches and keeps the binding live while the thread is active', async () => {
    await installRegistry();
    const bindings = (await load())!;
    bindings.sync('t1', cycleA);
    await bindings.listLive();
    clock = NOW + TOUCH_INTERVAL_MS + 1;
    bindings.touch('t1');
    await bindings.listLive();
    clock = NOW + 29 * 60_000;
    expect((await bindings.listLive()).map((b) => b.sessionId)).toEqual(['studio-t1']);
    clock = NOW + 32 * 60_000;
    expect(await bindings.listLive()).toEqual([]);
  });

  describe('judge', () => {
    const judge = (bindings: SessionBindings, unit: RegistryUnit | null, openUnits: RegistryUnit[], gate: 'block' | 'warn' = 'block') =>
      bindings.judge({ threadId: 't1', unit, gate, openUnits, rel: 'apps/x.ts' });

    it('allows a thread bound to an open unit', async () => {
      await installRegistry();
      const bindings = (await load())!;
      expect(judge(bindings, cycleA, [cycleA, cycleB])).toEqual({ kind: 'allow' });
    });

    it('denies an unbound thread when several units are open, and allows with a single one', async () => {
      await installRegistry();
      const bindings = (await load())!;
      expect(judge(bindings, null, [cycleA, cycleB])).toMatchObject({ kind: 'deny' });
      expect(judge(bindings, null, [cycleA, cycleB], 'warn')).toMatchObject({ kind: 'warn' });
      expect(judge(bindings, null, [cycleA])).toEqual({ kind: 'allow' });
    });

    it('denies a thread bound to a unit that is no longer open', async () => {
      await installRegistry();
      const bindings = (await load())!;
      const verdict = judge(bindings, cycleA, [cycleB, fixX]);
      expect(verdict).toMatchObject({ kind: 'deny' });
      expect((verdict as { reason: string }).reason).toContain('spec-a-001/cycle-01');
    });
  });
});

const reasonOf = (verdict: ReturnType<SessionBindings['judge']>): string =>
  verdict && verdict.kind !== 'allow' ? verdict.reason : '';

describe('SessionBindings file leases', () => {
  const judge = (bindings: SessionBindings, threadId: string, unit: RegistryUnit, rel = 'src/auth.ts') =>
    bindings.judge({ threadId, unit, gate: 'block', openUnits: [cycleA, cycleB], rel });

  it('takes a lease on an allowed edit and denies the same file to another conversation', async () => {
    await installRegistry();
    const bindings = (await load())!;
    bindings.sync('t1', cycleA);
    bindings.sync('t2', cycleB);
    expect(judge(bindings, 't1', cycleA)).toEqual({ kind: 'allow' });
    await bindings.listLive();
    const denied = judge(bindings, 't2', cycleB);
    expect(denied?.kind).toBe('deny');
    expect(reasonOf(denied)).toContain('reserved by another session in this same folder (spec-a-001/cycle-01');
    const leases = await bindings.listLeases();
    expect(leases).toEqual([
      expect.objectContaining({
        path: 'src/auth.ts',
        sessionId: 'studio-t1',
        unit: { kind: 'cycle', specId: 'spec-a-001', cycle: 'cycle-01' },
        requestedBy: ['spec-b-002/cycle-01'],
      }),
    ]);
  });

  it('releases the leases of a conversation when it ends', async () => {
    await installRegistry();
    const bindings = (await load())!;
    bindings.sync('t1', cycleA);
    bindings.sync('t2', cycleB);
    judge(bindings, 't1', cycleA);
    await bindings.listLive();
    bindings.end('t1');
    await bindings.listLive();
    expect(await bindings.listLeases()).toEqual([]);
    expect(judge(bindings, 't2', cycleB)).toEqual({ kind: 'allow' });
  });

  it('only warns when the holder works from another worktree', async () => {
    await installRegistry();
    const lib = await import(path.join(root, 'sdd', 'scripts', 'lib', 'session-registry.mjs'));
    const fs = {
      read: (file: string) => readFile(file, 'utf8'),
      write: async (file: string, text: string) => {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, text, 'utf8');
      },
      list: async (dir: string) => (await readdir(dir)).map((name) => ({ name })),
    };
    await lib.acquireLease(fs, path.join(root, '.git', 'sdd-sessions').replace(/\\/g, '/'), {
      rel: 'src/auth.ts',
      sessionId: 'claude-other',
      unit: cycleA,
      worktree: '/somewhere/else',
      harness: 'claude-code',
      now: NOW,
    });
    const bindings = (await load())!;
    bindings.sync('t2', cycleB);
    const verdict = judge(bindings, 't2', cycleB);
    expect(verdict?.kind).toBe('warn');
    expect(reasonOf(verdict)).toContain('from another worktree');
  });
});
