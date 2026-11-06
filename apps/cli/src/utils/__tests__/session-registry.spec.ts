import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type CycleUnit = { kind: 'cycle'; spec: string; cycle: string };
type FixUnit = { kind: 'fix'; fix: string };
type Unit = CycleUnit | FixUnit;
type Binding = {
  session_id: string;
  unit: Unit;
  worktree: string;
  harness: string;
  source: string;
  bound_at: string;
  updated_at: string;
  ended_at: string | null;
};
type MemoryFs = {
  read: (path: string) => Promise<string>;
  write: (path: string, text: string) => Promise<void>;
  list: (path: string) => Promise<{ name: string }[]>;
};
type Verdict = { kind: string; code?: string; reason?: string };
type Registry = {
  SESSION_TTL_MS: number;
  resolveRegistryDir: (fs: MemoryFs, root: string) => Promise<string>;
  readBranch: (fs: MemoryFs, root: string) => Promise<string | null>;
  formatBindMarker: (unit: Unit) => string;
  parseBindMarker: (text: string) => Unit | null;
  openUnitsOf: (cycles: { spec: string; cycle: string }[], fixes: { id: string }[]) => Unit[];
  unitFromBranch: (branch: string | null, units: Unit[]) => Unit | null;
  writeBinding: (
    fs: MemoryFs,
    dir: string,
    args: { sessionId: string; unit: Unit; worktree: string; harness: string; source: string; now: number },
  ) => Promise<Binding>;
  readBinding: (fs: MemoryFs, dir: string, sessionId: string) => Promise<Binding | null>;
  touchBinding: (fs: MemoryFs, dir: string, sessionId: string, now: number) => Promise<Binding | null>;
  endBinding: (fs: MemoryFs, dir: string, sessionId: string, now: number) => Promise<Binding | null>;
  listLiveBindings: (fs: MemoryFs, dir: string, now: number) => Promise<Binding[]>;
  autoBindUnit: (args: {
    binding: Binding | null;
    openUnits: Unit[];
    branch: string | null;
    now: number;
  }) => { unit: Unit; source: string } | null;
  judgeSessionEdit: (args: {
    gate: 'block' | 'warn';
    binding: Binding | null;
    openUnits: Unit[];
    rel: string;
    now: number;
  }) => Verdict;
};

const REGISTRY = resolve(__dirname, '../../../templates/sdd/scripts/lib/session-registry.mjs');
let registry: Registry;

beforeAll(async () => {
  registry = (await import(pathToFileURL(REGISTRY).href)) as Registry;
});

function memoryFs(seed: Record<string, string> = {}): MemoryFs & { files: Map<string, string> } {
  const files = new Map(Object.entries(seed));
  return {
    files,
    read: async (path) => {
      const text = files.get(path);
      if (text === undefined) throw new Error(`ENOENT ${path}`);
      return text;
    },
    write: async (path, text) => {
      files.set(path, text);
    },
    list: async (path) => {
      const prefix = `${path}/`;
      const names = [...files.keys()]
        .filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
        .map((key) => ({ name: key.slice(prefix.length) }));
      if (names.length === 0) throw new Error(`ENOENT ${path}`);
      return names;
    },
  };
}

const SPEC_A: CycleUnit = { kind: 'cycle', spec: 'spec-dev-001-auth', cycle: 'cycle-02' };
const SPEC_B: CycleUnit = { kind: 'cycle', spec: 'spec-dev-002-billing', cycle: 'cycle-01' };
const FIX: FixUnit = { kind: 'fix', fix: 'FIX-dev-001-001' };
const NOW = Date.parse('2026-11-06T12:00:00Z');
const DIR = '/repo/.git/sdd-sessions';

describe('resolveRegistryDir', () => {
  it('uses the common git dir of a plain checkout', async () => {
    const fs = memoryFs({ '/repo/.git/HEAD': 'ref: refs/heads/main\n' });
    expect(await registry.resolveRegistryDir(fs, '/repo')).toBe('/repo/.git/sdd-sessions');
  });

  it('follows a worktree pointer to the shared common dir', async () => {
    const fs = memoryFs({
      '/wt/feat/.git': 'gitdir: /repo/.git/worktrees/feat\n',
      '/repo/.git/worktrees/feat/commondir': '../..\n',
      '/repo/.git/worktrees/feat/HEAD': 'ref: refs/heads/feat/spec-dev-001-auth\n',
    });
    expect(await registry.resolveRegistryDir(fs, '/wt/feat')).toBe('/repo/.git/sdd-sessions');
    expect(await registry.readBranch(fs, '/wt/feat')).toBe('feat/spec-dev-001-auth');
  });

  it('normalizes Windows paths', async () => {
    const fs = memoryFs({
      'C:/wt/.git': 'gitdir: C:/repo/.git/worktrees/wt\n',
      'C:/repo/.git/worktrees/wt/commondir': '../..\n',
    });
    expect(await registry.resolveRegistryDir(fs, 'C:\\wt')).toBe('C:/repo/.git/sdd-sessions');
  });

  it('falls back to sdd/.sessions without git', async () => {
    expect(await registry.resolveRegistryDir(memoryFs(), '/repo')).toBe('/repo/sdd/.sessions');
  });
});

describe('bind marker', () => {
  it('round-trips cycles and fixes', () => {
    expect(registry.parseBindMarker(registry.formatBindMarker(SPEC_A))).toEqual(SPEC_A);
    expect(registry.parseBindMarker(registry.formatBindMarker(FIX))).toEqual(FIX);
  });

  it('finds the last marker inside noisy output and ignores malformed ones', () => {
    const output = `> pnpm sdd:gate\n→ APPROVED\nSDD-BIND spec=${SPEC_A.spec} cycle=${SPEC_A.cycle}\nSDD-BIND spec=x cycle=nope\n`;
    expect(registry.parseBindMarker(output)).toEqual(SPEC_A);
    expect(registry.parseBindMarker('APPROVED')).toBeNull();
  });
});

describe('units', () => {
  const units = (): Unit[] => registry.openUnitsOf([SPEC_A, SPEC_B], [{ id: FIX.fix }]);

  it('lists cycles and fixes as units', () => {
    expect(units()).toEqual([SPEC_A, SPEC_B, FIX]);
  });

  it('maps a branch naming a spec to its open cycle', () => {
    expect(registry.unitFromBranch('feat/spec-dev-002-billing', units())).toEqual(SPEC_B);
    expect(registry.unitFromBranch('main', units())).toBeNull();
    expect(registry.unitFromBranch(null, units())).toBeNull();
  });
});

describe('bindings on disk', () => {
  const bind = (fs: MemoryFs, sessionId: string, unit: Unit, now = NOW) =>
    registry.writeBinding(fs, DIR, { sessionId, unit, worktree: '/repo', harness: 'claude-code', source: 'sdd-use', now });

  it('writes one file per session and reads it back', async () => {
    const fs = memoryFs();
    await bind(fs, 'abc-1', SPEC_A);
    expect(fs.files.has(`${DIR}/sessions/abc-1.json`)).toBe(true);
    expect((await registry.readBinding(fs, DIR, 'abc-1'))?.unit).toEqual(SPEC_A);
  });

  it('keeps bound_at when rebinding to the same unit and resets it for another', async () => {
    const fs = memoryFs();
    const first = await bind(fs, 's', SPEC_A, NOW);
    expect((await bind(fs, 's', SPEC_A, NOW + 1000)).bound_at).toBe(first.bound_at);
    expect((await bind(fs, 's', SPEC_B, NOW + 2000)).bound_at).not.toBe(first.bound_at);
  });

  it('rejects session ids that could escape the folder', async () => {
    await expect(bind(memoryFs(), '../evil', SPEC_A)).rejects.toThrow('invalid session id');
  });

  it('lists only live bindings: ended and stale ones drop out', async () => {
    const fs = memoryFs();
    await bind(fs, 'live', SPEC_A);
    await bind(fs, 'ended', SPEC_B);
    await registry.endBinding(fs, DIR, 'ended', NOW + 1);
    await bind(fs, 'stale', FIX, NOW - registry.SESSION_TTL_MS - 1);
    fs.files.set(`${DIR}/sessions/broken.json`, '{nope');
    const live = await registry.listLiveBindings(fs, DIR, NOW + 10);
    expect(live.map((b) => b.session_id)).toEqual(['live']);
  });

  it('touch keeps a binding alive past the original TTL', async () => {
    const fs = memoryFs();
    await bind(fs, 's', SPEC_A, NOW);
    await registry.touchBinding(fs, DIR, 's', NOW + registry.SESSION_TTL_MS - 1);
    const live = await registry.listLiveBindings(fs, DIR, NOW + registry.SESSION_TTL_MS + 5);
    expect(live).toHaveLength(1);
  });

  it('returns an empty list when the registry does not exist yet', async () => {
    expect(await registry.listLiveBindings(memoryFs(), DIR, NOW)).toEqual([]);
  });
});

describe('autoBindUnit', () => {
  const binding = (unit: Unit, ended: string | null = null): Binding => ({
    session_id: 's',
    unit,
    worktree: '/repo',
    harness: 'claude-code',
    source: 'sdd-use',
    bound_at: new Date(NOW).toISOString(),
    updated_at: new Date(NOW).toISOString(),
    ended_at: ended,
  });

  it('binds to the only open unit', () => {
    expect(registry.autoBindUnit({ binding: null, openUnits: [SPEC_A], branch: null, now: NOW })).toEqual({
      unit: SPEC_A,
      source: 'single-unit',
    });
  });

  it('binds by branch when several units are open', () => {
    expect(
      registry.autoBindUnit({ binding: null, openUnits: [SPEC_A, SPEC_B], branch: 'feat/spec-dev-001-auth', now: NOW }),
    ).toEqual({ unit: SPEC_A, source: 'branch' });
  });

  it('leaves a live binding to an open unit alone', () => {
    expect(registry.autoBindUnit({ binding: binding(SPEC_B), openUnits: [SPEC_A, SPEC_B], branch: 'feat/spec-dev-001-auth', now: NOW })).toBeNull();
  });

  it('does not guess with several units and no matching branch', () => {
    expect(registry.autoBindUnit({ binding: null, openUnits: [SPEC_A, SPEC_B], branch: 'main', now: NOW })).toBeNull();
  });
});

describe('judgeSessionEdit', () => {
  const live = (unit: Unit): Binding => ({
    session_id: 's',
    unit,
    worktree: '/repo',
    harness: 'claude-code',
    source: 'sdd-use',
    bound_at: new Date(NOW).toISOString(),
    updated_at: new Date(NOW).toISOString(),
    ended_at: null,
  });
  const judge = (binding: Binding | null, openUnits: Unit[], gate: 'block' | 'warn' = 'block') =>
    registry.judgeSessionEdit({ gate, binding, openUnits, rel: 'src/a.ts', now: NOW });

  it('denies with no open unit at all', () => {
    expect(judge(null, [])).toMatchObject({ kind: 'deny', code: 'none' });
  });

  it('allows a session bound to an open unit', () => {
    expect(judge(live(SPEC_B), [SPEC_A, SPEC_B, FIX])).toEqual({ kind: 'allow' });
  });

  it('allows an unbound session when only one unit is open', () => {
    expect(judge(null, [FIX])).toEqual({ kind: 'allow' });
  });

  it('asks an unbound session to choose when several units are open', () => {
    const verdict = judge(null, [SPEC_A, FIX]);
    expect(verdict).toMatchObject({ kind: 'deny', code: 'unbound' });
    expect(verdict.reason).toContain(`pnpm sdd:use ${SPEC_A.spec} ${SPEC_A.cycle}`);
    expect(verdict.reason).toContain(`pnpm sdd:use ${FIX.fix}`);
  });

  it('flags a binding to a unit that is no longer open', () => {
    expect(judge(live(SPEC_B), [SPEC_A])).toMatchObject({ kind: 'deny', code: 'closed' });
  });

  it('only warns in warn mode', () => {
    expect(judge(null, [SPEC_A, SPEC_B], 'warn')).toMatchObject({ kind: 'warn', code: 'unbound' });
  });
});

type Lease = {
  path: string;
  session_id: string;
  unit: Unit | null;
  worktree: string;
  harness: string;
  acquired_at: string;
  updated_at: string;
  released_at: string | null;
};
type InboxMessage = { id: string; kind: string; path: string; from_session: string; to_session: string; read_at: string | null };
type LeaseRegistry = {
  LEASE_TTL_MS: number;
  leaseKey: (rel: string) => string;
  readLease: (fs: MemoryFs, dir: string, rel: string) => Promise<Lease | null>;
  listLiveLeases: (fs: MemoryFs, dir: string, now: number) => Promise<Lease[]>;
  acquireLease: (
    fs: MemoryFs,
    dir: string,
    args: { rel: string; sessionId: string; unit: Unit | null; worktree: string; harness: string; now: number },
  ) => Promise<{ acquired: boolean; lease: Lease }>;
  releaseLease: (fs: MemoryFs, dir: string, rel: string, now: number, options?: { sessionId?: string }) => Promise<Lease | null>;
  releaseSessionLeases: (fs: MemoryFs, dir: string, sessionId: string, now: number) => Promise<Lease[]>;
  judgeFileLease: (args: { gate: 'block' | 'warn'; lease: Lease | null; sessionId: string; worktree: string; now: number }) => Verdict;
  requestLease: (
    fs: MemoryFs,
    dir: string,
    args: { lease: Lease; fromSessionId: string; fromUnit: Unit | null; now: number },
  ) => Promise<{ created: boolean; message: InboxMessage }>;
  listInbox: (fs: MemoryFs, dir: string, sessionId: string, options?: { unreadOnly?: boolean }) => Promise<InboxMessage[]>;
  markInboxRead: (fs: MemoryFs, dir: string, sessionId: string, ids: string[], now: number) => Promise<void>;
  notifyRequesters: (fs: MemoryFs, dir: string, released: Lease, now: number) => Promise<string[]>;
  inboxText: (messages: InboxMessage[]) => string;
};

describe('file leases', () => {
  const lib = () => registry as unknown as LeaseRegistry;
  const take = (fs: MemoryFs, sessionId: string, rel = 'src/auth/session.ts', now = NOW, worktree = '/repo') =>
    lib().acquireLease(fs, DIR, { rel, sessionId, unit: SPEC_A, worktree, harness: 'claude-code', now });

  it('derives the same key for equivalent paths', () => {
    expect(lib().leaseKey('./src/a.ts')).toBe(lib().leaseKey('src/a.ts'));
    expect(lib().leaseKey('src/a.ts')).not.toBe(lib().leaseKey('src/b.ts'));
    expect(lib().leaseKey('src/a.ts')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('takes a free file and keeps acquired_at while the owner refreshes it', async () => {
    const fs = memoryFs();
    const first = await take(fs, 'a');
    expect(first.acquired).toBe(true);
    const again = await take(fs, 'a', 'src/auth/session.ts', NOW + 1000);
    expect(again.lease.acquired_at).toBe(first.lease.acquired_at);
    expect(again.lease.updated_at).not.toBe(first.lease.updated_at);
  });

  it('refuses a file another live session holds and frees it after the TTL', async () => {
    const fs = memoryFs();
    await take(fs, 'a');
    const blocked = await take(fs, 'b', 'src/auth/session.ts', NOW + 10);
    expect(blocked).toMatchObject({ acquired: false, lease: { session_id: 'a' } });
    const later = await take(fs, 'b', 'src/auth/session.ts', NOW + lib().LEASE_TTL_MS + 1);
    expect(later.acquired).toBe(true);
  });

  it('releases one file, only for its owner when asked, and all of a session', async () => {
    const fs = memoryFs();
    await take(fs, 'a', 'src/a.ts');
    await take(fs, 'a', 'src/b.ts');
    await take(fs, 'c', 'src/c.ts');
    expect(await lib().releaseLease(fs, DIR, 'src/a.ts', NOW + 1, { sessionId: 'c' })).toBeNull();
    expect(await lib().releaseLease(fs, DIR, 'src/a.ts', NOW + 1)).toMatchObject({ path: 'src/a.ts' });
    expect((await lib().releaseSessionLeases(fs, DIR, 'a', NOW + 2)).map((l) => l.path)).toEqual(['src/b.ts']);
    expect((await lib().listLiveLeases(fs, DIR, NOW + 3)).map((l) => l.path)).toEqual(['src/c.ts']);
  });

  it('ignores a lock file whose stored path does not match', async () => {
    const fs = memoryFs();
    fs.files.set(`${DIR}/locks/${lib().leaseKey('src/a.ts')}.json`, JSON.stringify({ path: 'src/other.ts' }));
    expect(await lib().readLease(fs, DIR, 'src/a.ts')).toBeNull();
  });
});

describe('judgeFileLease', () => {
  const lib = () => registry as unknown as LeaseRegistry;
  const lease = (worktree = '/repo', released: string | null = null): Lease => ({
    path: 'src/a.ts',
    session_id: 'owner',
    unit: SPEC_A,
    worktree,
    harness: 'claude-code',
    acquired_at: new Date(NOW - 120000).toISOString(),
    updated_at: new Date(NOW - 60000).toISOString(),
    released_at: released,
  });
  const judge = (l: Lease | null, sessionId = 'me', gate: 'block' | 'warn' = 'block') =>
    lib().judgeFileLease({ gate, lease: l, sessionId, worktree: '/repo', now: NOW });

  it('allows free files, own leases and released ones', () => {
    expect(judge(null)).toEqual({ kind: 'allow' });
    expect(judge(lease(), 'owner')).toEqual({ kind: 'allow' });
    expect(judge(lease('/repo', new Date(NOW).toISOString()))).toEqual({ kind: 'allow' });
  });

  it('denies in the same folder and names the holder', () => {
    const verdict = judge(lease());
    expect(verdict).toMatchObject({ kind: 'deny', code: 'leased-here' });
    expect(verdict.reason).toContain(`${SPEC_A.spec}/${SPEC_A.cycle}`);
    expect(verdict.reason).toContain('pnpm sdd:release src/a.ts');
  });

  it('only warns in warn mode or from another worktree', () => {
    expect(judge(lease(), 'me', 'warn')).toMatchObject({ kind: 'warn', code: 'leased-here' });
    expect(judge(lease('/wt/other'))).toMatchObject({ kind: 'warn', code: 'leased-elsewhere' });
  });
});

describe('inbox', () => {
  const lib = () => registry as unknown as LeaseRegistry;

  it('leaves one request per session and lease, reads it and marks it read', async () => {
    const fs = memoryFs();
    const { lease } = await lib().acquireLease(fs, DIR, {
      rel: 'src/a.ts',
      sessionId: 'owner',
      unit: SPEC_A,
      worktree: '/repo',
      harness: 'claude-code',
      now: NOW,
    });
    expect((await lib().requestLease(fs, DIR, { lease, fromSessionId: 'me', fromUnit: SPEC_B, now: NOW + 1 })).created).toBe(true);
    expect((await lib().requestLease(fs, DIR, { lease, fromSessionId: 'me', fromUnit: SPEC_B, now: NOW + 2 })).created).toBe(false);
    const unread = await lib().listInbox(fs, DIR, 'owner');
    expect(unread).toHaveLength(1);
    expect(lib().inboxText(unread)).toContain(`${SPEC_B.spec}/${SPEC_B.cycle} necesita src/a.ts`);
    await lib().markInboxRead(fs, DIR, 'owner', unread.map((m) => m.id), NOW + 3);
    expect(await lib().listInbox(fs, DIR, 'owner')).toEqual([]);
  });

  it('tells the requesters once the lease is released', async () => {
    const fs = memoryFs();
    const { lease } = await lib().acquireLease(fs, DIR, {
      rel: 'src/a.ts',
      sessionId: 'owner',
      unit: SPEC_A,
      worktree: '/repo',
      harness: 'claude-code',
      now: NOW,
    });
    await lib().requestLease(fs, DIR, { lease, fromSessionId: 'me', fromUnit: SPEC_B, now: NOW + 1 });
    const released = await lib().releaseLease(fs, DIR, 'src/a.ts', NOW + 2);
    expect(await lib().notifyRequesters(fs, DIR, released!, NOW + 3)).toEqual(['me']);
    expect(await lib().notifyRequesters(fs, DIR, released!, NOW + 4)).toEqual([]);
    const [notice] = await lib().listInbox(fs, DIR, 'me');
    expect(notice).toMatchObject({ kind: 'lease-released', path: 'src/a.ts' });
    expect(lib().inboxText([notice])).toContain('lo liberó');
  });
});
