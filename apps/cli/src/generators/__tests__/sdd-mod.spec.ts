import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

// The mod's pure logic (templates/sdd/skills/sdd-mod/hooks/.src/sdd.ts) is loaded at run time: its
// type contract augments the 'claude-code' module, which only Claude Code provides, so tsc must
// not follow the import. The local types below mirror what the tests touch.
const SDD_TS = resolve(__dirname, '../../../templates/sdd/skills/sdd-mod/hooks/.src/sdd.ts');

type Unit = { kind: 'cycle'; spec: string; cycle: string } | { kind: 'fix'; fix: string };
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
type Snapshot = {
  settings: { enabled: boolean; gate: 'block' | 'warn' };
  cycles: { spec: string; cycle: string; flow: string; tasks: { status: string }[] }[];
  fixes: { id: string; status: string }[];
  openUnits: Unit[];
  mine: Binding | null;
  others: Binding[];
  registryError?: string;
  error?: string;
};
type Reader = {
  read: (path: string) => Promise<string>;
  list: (path: string) => Promise<{ name: string; kind: string }[]>;
};
type Store = Reader & { write: (path: string, text: string) => Promise<void> };
type Session = { id: string; now: number };
type SddModule = {
  readSettings: (tools: unknown) => Snapshot['settings'];
  relativeToRoot: (root: string, filePath: string) => string | null;
  isCodePath: (rel: string) => boolean;
  judgeEdit: (s: Snapshot, root: string, filePath: string, now?: number) => { kind: string; reason?: string };
  loadSnapshot: (reader: Reader | Store, root: string, session?: Session) => Promise<Snapshot>;
  bandLine: (s: Snapshot) => string | null;
  outputText: (result: unknown) => string;
  bindFromCommand: (store: Store, root: string, session: Session, command: string, output: unknown) => Promise<Unit | null>;
  touchSession: (store: Store, root: string, session: Session) => Promise<Binding | null>;
  endSession: (store: Store, root: string, session: Session) => Promise<Binding | null>;
  holderOf: (s: Snapshot, unit: Unit) => 'mine' | 'other' | null;
};

let sdd: SddModule;

beforeAll(async () => {
  sdd = (await import(SDD_TS)) as SddModule;
});

const ROOT = '/repo';

function snapshot(partial: Partial<Snapshot> = {}): Snapshot {
  return {
    settings: { enabled: true, gate: 'block' },
    cycles: [],
    fixes: [],
    openUnits: [],
    mine: null,
    others: [],
    ...partial,
  };
}

function memoryStore(files: Record<string, unknown>): Store {
  const reader = memoryReader(files);
  return {
    ...reader,
    write: async (path, text) => {
      files[path] = text;
    },
  };
}

/** In-memory sdd/: keys are absolute paths, directories are listed from them. */
function memoryReader(files: Record<string, unknown>): Reader {
  const text = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
  return {
    read: async (path) => {
      if (!(path in files)) throw new Error(`ENOENT ${path}`);
      return text(files[path]);
    },
    list: async (dir) => {
      const names = new Set<string>();
      for (const key of Object.keys(files)) {
        if (key.startsWith(`${dir}/`)) names.add(key.slice(dir.length + 1).split('/')[0]!);
      }
      if (names.size === 0) throw new Error(`ENOENT ${dir}`);
      return [...names].map((name) => ({ name, kind: 'dir' }));
    },
  };
}

describe('sdd-mod: settings', () => {
  it('apagado por defecto; gate block salvo "warn" explícito', () => {
    expect(sdd.readSettings(null)).toEqual({ enabled: false, gate: 'block' });
    expect(sdd.readSettings({ rtk: { enabled: true } })).toEqual({ enabled: false, gate: 'block' });
    expect(sdd.readSettings({ claude_mod: { enabled: true } })).toEqual({ enabled: true, gate: 'block' });
    expect(sdd.readSettings({ claude_mod: { enabled: 'yes', gate: 'warn' } })).toEqual({
      enabled: false,
      gate: 'warn',
    });
  });
});

describe('sdd-mod: paths', () => {
  it('resuelve rutas absolutas, relativas, con .. y de Windows', () => {
    expect(sdd.relativeToRoot(ROOT, '/repo/src/a.ts')).toBe('src/a.ts');
    expect(sdd.relativeToRoot(ROOT, 'src/a.ts')).toBe('src/a.ts');
    expect(sdd.relativeToRoot(ROOT, '/repo/sdd/../src/./a.ts')).toBe('src/a.ts');
    expect(sdd.relativeToRoot(ROOT, '/repo-other/a.ts')).toBeNull();
    expect(sdd.relativeToRoot(ROOT, '/tmp/a.ts')).toBeNull();
    expect(sdd.relativeToRoot('C:\\work\\repo', 'C:\\work\\repo\\apps\\x.ts')).toBe('apps/x.ts');
  });

  it('sdd/, superficies de agentes y markdown raíz no son código', () => {
    for (const rel of ['sdd/fixes.json', '.claude/settings.json', '.github/x.yml', 'README.md']) {
      expect(sdd.isCodePath(rel), rel).toBe(false);
    }
    for (const rel of ['src/a.ts', 'apps/web/README.md', 'package.json', 'Dockerfile']) {
      expect(sdd.isCodePath(rel), rel).toBe(true);
    }
  });
});

describe('sdd-mod: SPEC GATE sobre ediciones', () => {
  it('sin ciclo ni fix: block rechaza, warn avisa; apagado o fuera del código deja pasar', () => {
    expect(sdd.judgeEdit(snapshot(), ROOT, '/repo/src/a.ts').kind).toBe('deny');
    expect(sdd.judgeEdit(snapshot(), ROOT, '/repo/src/a.ts').reason).toContain('src/a.ts');
    const warn = snapshot({ settings: { enabled: true, gate: 'warn' } });
    expect(sdd.judgeEdit(warn, ROOT, '/repo/src/a.ts').kind).toBe('warn');
    const off = snapshot({ settings: { enabled: false, gate: 'block' } });
    expect(sdd.judgeEdit(off, ROOT, '/repo/src/a.ts').kind).toBe('allow');
    expect(sdd.judgeEdit(snapshot(), ROOT, '/repo/sdd/specs/index.json').kind).toBe('allow');
    expect(sdd.judgeEdit(snapshot(), ROOT, '/elsewhere/a.ts').kind).toBe('allow');
  });

  const cycleUnit = (n: number): Unit => ({ kind: 'cycle', spec: 'spec-x-001-a', cycle: `cycle-0${n}` });
  const fixUnit: Unit = { kind: 'fix', fix: 'FIX-x-001' };
  const NOW = Date.parse('2026-11-06T12:00:00.000Z');
  const bindingTo = (unit: Unit, ageMs = 1000): Binding => ({
    session_id: 's1',
    unit,
    worktree: ROOT,
    harness: 'claude-code',
    source: 'sdd-use',
    bound_at: new Date(NOW - ageMs).toISOString(),
    updated_at: new Date(NOW - ageMs).toISOString(),
    ended_at: null,
  });

  it('una sola unidad abierta habilita aunque la sesión no esté atada; un error de lectura no bloquea', () => {
    expect(sdd.judgeEdit(snapshot({ openUnits: [cycleUnit(1)] }), ROOT, 'src/a.ts', NOW).kind).toBe('allow');
    expect(sdd.judgeEdit(snapshot({ openUnits: [fixUnit] }), ROOT, 'src/a.ts', NOW).kind).toBe('allow');
    expect(sdd.judgeEdit(snapshot({ error: 'boom' }), ROOT, 'src/a.ts', NOW).kind).toBe('allow');
  });

  it('con varias unidades abiertas, la sesión sin atadura recibe un deny que las lista y dice cómo elegir', () => {
    const open = snapshot({ openUnits: [cycleUnit(1), fixUnit] });
    const verdict = sdd.judgeEdit(open, ROOT, '/repo/src/a.ts', NOW);
    expect(verdict.kind).toBe('deny');
    expect(verdict.reason).toContain('pnpm sdd:use spec-x-001-a cycle-01');
    expect(verdict.reason).toContain('pnpm sdd:use FIX-x-001');
    const warn = snapshot({ settings: { enabled: true, gate: 'warn' }, openUnits: [cycleUnit(1), fixUnit] });
    expect(sdd.judgeEdit(warn, ROOT, '/repo/src/a.ts', NOW).kind).toBe('warn');
    expect(sdd.judgeEdit(open, ROOT, '/repo/sdd/fixes.json', NOW).kind).toBe('allow');
  });

  it('atada a una unidad abierta pasa; atada a una cerrada o vencida no', () => {
    const units = [cycleUnit(1), fixUnit];
    const bound = snapshot({ openUnits: units, mine: bindingTo(fixUnit) });
    expect(sdd.judgeEdit(bound, ROOT, 'src/a.ts', NOW).kind).toBe('allow');
    const closed = snapshot({ openUnits: units, mine: bindingTo(cycleUnit(2)) });
    const verdict = sdd.judgeEdit(closed, ROOT, 'src/a.ts', NOW);
    expect(verdict.kind).toBe('deny');
    expect(verdict.reason).toContain('ya no está abierto');
    const stale = snapshot({ openUnits: units, mine: bindingTo(fixUnit, 31 * 60 * 1000) });
    expect(sdd.judgeEdit(stale, ROOT, 'src/a.ts', NOW).kind).toBe('deny');
  });

  it('si el registro de sesiones no se pudo leer, la edición pasa', () => {
    const broken = snapshot({ openUnits: [cycleUnit(1), fixUnit], registryError: 'EACCES' });
    expect(sdd.judgeEdit(broken, ROOT, 'src/a.ts', NOW).kind).toBe('allow');
    expect(sdd.judgeEdit(snapshot({ registryError: 'EACCES' }), ROOT, 'src/a.ts', NOW).kind).toBe('deny');
  });
});

describe('sdd-mod: lectura de sdd/', () => {
  const spec = (id: string, status: string) => ({
    id,
    title: `Title ${id}`,
    status,
    folder: `sdd/specs/${id}`,
  });

  it('junta solo ciclos in-progress de specs abiertas y fixes pending/in-progress', async () => {
    const reader = memoryReader({
      '/repo/sdd/tools.json': { claude_mod: { enabled: true, gate: 'warn' } },
      '/repo/sdd/specs/index.json': {
        specs: [spec('spec-x-001-a', 'in-progress'), spec('spec-x-002-b', 'completed')],
      },
      '/repo/sdd/specs/spec-x-001-a/cycles/cycle-01/cycle.json': { status: 'completed', flow: 'full' },
      '/repo/sdd/specs/spec-x-001-a/cycles/cycle-02/cycle.json': { status: 'in-progress', flow: 'lite' },
      '/repo/sdd/specs/spec-x-001-a/cycles/cycle-02/tasks.json': {
        tasks: [
          { id: 'TASK-001', title: 'a', status: 'done' },
          { id: 'TASK-002', title: 'b', status: 'pending' },
          { id: 'TASK-003', title: 'c', status: 'skipped' },
        ],
      },
      '/repo/sdd/specs/spec-x-002-b/cycles/cycle-01/cycle.json': { status: 'in-progress' },
      '/repo/sdd/fixes.json': {
        fixes: [
          { id: 'FIX-x-001', title: 'open', status: 'in-progress' },
          { id: 'FIX-x-002', title: 'closed', status: 'validated' },
        ],
      },
    });

    const result = await sdd.loadSnapshot(reader, ROOT);
    expect(result.settings).toEqual({ enabled: true, gate: 'warn' });
    expect(result.cycles.map((c) => `${c.spec}/${c.cycle}/${c.flow}`)).toEqual([
      'spec-x-001-a/cycle-02/lite',
    ]);
    expect(result.fixes.map((f) => f.id)).toEqual(['FIX-x-001']);
    expect(result.openUnits).toEqual([
      { kind: 'cycle', spec: 'spec-x-001-a', cycle: 'cycle-02' },
      { kind: 'fix', fix: 'FIX-x-001' },
    ]);
    expect(result.mine).toBeNull();
    expect(sdd.bandLine(result)).toBe(
      'SDD ▸ esta sesión: sin unidad · otras: spec-x-001-a/cycle-02, FIX-x-001 · /sdd',
    );
  });

  it('apagado no lee nada más; sin specs/index.json queda en error y la franja lo dice', async () => {
    const off = await sdd.loadSnapshot(memoryReader({}), ROOT);
    expect(off.settings.enabled).toBe(false);
    expect(sdd.bandLine(off)).toBeNull();

    const broken = await sdd.loadSnapshot(
      memoryReader({ '/repo/sdd/tools.json': { claude_mod: { enabled: true } } }),
      ROOT,
    );
    expect(broken.error).toContain('ENOENT');
    expect(sdd.bandLine(broken)).toContain('gate en pausa');
    expect(sdd.bandLine(snapshot())).toContain('escribir código: bloqueado');
  });
});


describe('sdd-mod: atadura de la sesión', () => {
  const NOW = Date.parse('2026-11-06T12:00:00.000Z');
  const session: Session = { id: 'sess-1', now: NOW };
  const REGISTRY = '/repo/sdd/.sessions/sessions';
  const unit = { kind: 'cycle', spec: 'spec-x-001-a', cycle: 'cycle-01' } as const;
  const other = { kind: 'cycle', spec: 'spec-x-002-b', cycle: 'cycle-01' } as const;

  const specIndex = {
    specs: [
      { id: 'spec-x-001-a', title: 'A', status: 'in-progress', folder: 'sdd/specs/spec-x-001-a' },
      { id: 'spec-x-002-b', title: 'B', status: 'in-progress', folder: 'sdd/specs/spec-x-002-b' },
    ],
  };
  const tasks = (statuses: string[]) => ({
    tasks: statuses.map((status, i) => ({ id: `TASK-00${i + 1}`, title: 't', status })),
  });

  const twoCycles = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    '/repo/sdd/tools.json': { claude_mod: { enabled: true, gate: 'block' } },
    '/repo/sdd/specs/index.json': specIndex,
    '/repo/sdd/specs/spec-x-001-a/cycles/cycle-01/cycle.json': { status: 'in-progress', flow: 'lite' },
    '/repo/sdd/specs/spec-x-001-a/cycles/cycle-01/tasks.json': tasks(['done', 'pending']),
    '/repo/sdd/specs/spec-x-002-b/cycles/cycle-01/cycle.json': { status: 'in-progress', flow: 'full' },
    '/repo/sdd/specs/spec-x-002-b/cycles/cycle-01/tasks.json': tasks(['pending']),
    ...extra,
  });

  const registryFile = (id: string) => `${REGISTRY}/${id}.json`;

  it('con una sola unidad abierta la sesión se ata sola (single-unit) y la franja la muestra', async () => {
    const files = twoCycles();
    delete files['/repo/sdd/specs/spec-x-002-b/cycles/cycle-01/cycle.json'];
    const store = memoryStore(files);
    const snap = await sdd.loadSnapshot(store, ROOT, session);
    expect(snap.mine?.unit).toEqual(unit);
    expect(snap.mine?.source).toBe('single-unit');
    expect(JSON.parse(files[registryFile('sess-1')] as string).unit).toEqual(unit);
    expect(sdd.bandLine(snap)).toBe('SDD ▸ esta sesión: spec-x-001-a · cycle-01 · lite · 1/2 · /sdd');
  });

  it('con varias unidades y sin pista queda sin unidad; la rama que nombra una spec la ata', async () => {
    const unbound = await sdd.loadSnapshot(memoryStore(twoCycles()), ROOT, session);
    expect(unbound.mine).toBeNull();
    expect(sdd.bandLine(unbound)).toBe(
      'SDD ▸ esta sesión: sin unidad · otras: spec-x-001-a/cycle-01, spec-x-002-b/cycle-01 · /sdd',
    );

    const files = twoCycles({ '/repo/.git/HEAD': 'ref: refs/heads/feat/spec-x-002-b-thing\n' });
    const snap = await sdd.loadSnapshot(memoryStore(files), ROOT, session);
    expect(snap.mine?.unit).toEqual(other);
    expect(snap.mine?.source).toBe('branch');
    expect(files['/repo/.git/sdd-sessions/sessions/sess-1.json']).toBeDefined();
    expect(sdd.bandLine(snap)).toBe(
      'SDD ▸ esta sesión: spec-x-002-b · cycle-01 · full · 0/1 · otras: spec-x-001-a/cycle-01 · /sdd',
    );
  });

  it('muestra las ataduras vivas de otras sesiones y marca quién tiene cada unidad', async () => {
    const files = twoCycles();
    const store = memoryStore(files);
    await sdd.bindFromCommand(store, ROOT, { id: 'sess-2', now: NOW - 1000 }, 'pnpm sdd:use x', 'SDD-BIND spec=spec-x-002-b cycle=cycle-01');
    await sdd.bindFromCommand(store, ROOT, session, 'pnpm sdd:use x', 'SDD-BIND spec=spec-x-001-a cycle=cycle-01');
    const snap = await sdd.loadSnapshot(store, ROOT, session);
    expect(snap.others.map((b) => b.session_id)).toEqual(['sess-2']);
    expect(sdd.holderOf(snap, unit)).toBe('mine');
    expect(sdd.holderOf(snap, other)).toBe('other');
    expect(sdd.holderOf(snap, { kind: 'fix', fix: 'FIX-x-001' })).toBeNull();
  });

  it('una sesión vencida de otro no cuenta; un fix atado se ve como esta sesión: FIX-id', async () => {
    const files = twoCycles({
      '/repo/sdd/fixes.json': { fixes: [{ id: 'FIX-x-001', title: 'f', status: 'pending' }] },
    });
    const store = memoryStore(files);
    await sdd.bindFromCommand(store, ROOT, { id: 'old', now: NOW - 60 * 60 * 1000 }, 'pnpm sdd:use x', 'SDD-BIND fix=FIX-x-001');
    await sdd.bindFromCommand(store, ROOT, session, 'pnpm sdd:use x', 'SDD-BIND fix=FIX-x-001');
    const snap = await sdd.loadSnapshot(store, ROOT, session);
    expect(snap.others).toEqual([]);
    expect(sdd.bandLine(snap)).toBe(
      'SDD ▸ esta sesión: FIX-x-001 · otras: spec-x-001-a/cycle-01, spec-x-002-b/cycle-01 · /sdd',
    );
  });

  it('el marcador del Bash ata la sesión: gate-b si corrió sdd:gate, sdd-use si no; solo unidades abiertas', async () => {
    const store = memoryStore(twoCycles());
    const marker = 'SDD-BIND spec=spec-x-001-a cycle=cycle-01';
    expect(await sdd.bindFromCommand(store, ROOT, session, 'pnpm sdd:gate x cycle-01', `APPROVED\n${marker}\n`)).toEqual(unit);
    expect((await sdd.loadSnapshot(store, ROOT, session)).mine?.source).toBe('gate-b');
    expect(await sdd.bindFromCommand(store, ROOT, session, 'pnpm sdd:use x cycle-01', { stdout: `hi\n${marker}\n`, stderr: '' })).toEqual(unit);
    expect((await sdd.loadSnapshot(store, ROOT, session)).mine?.source).toBe('sdd-use');

    expect(await sdd.bindFromCommand(store, ROOT, session, 'pnpm sdd:use x cycle-09', 'SDD-BIND spec=spec-x-001-a cycle=cycle-09')).toBeNull();
    expect(await sdd.bindFromCommand(store, ROOT, session, 'cat docs.md', marker)).toBeNull();
    expect(await sdd.bindFromCommand(store, ROOT, session, 'pnpm sdd:use x', 'sin marcador')).toBeNull();
  });

  it('outputText junta string, stdout/stderr y result.stdout', () => {
    expect(sdd.outputText('a')).toBe('a');
    expect(sdd.outputText({ stdout: 'o', stderr: 'e' })).toBe('o\ne');
    expect(sdd.outputText({ result: { stdout: 'o' }, text: 't' })).toBe('o\nt');
    expect(sdd.outputText(undefined)).toBe('');
  });

  it('touch refresca updated_at y end escribe ended_at: la sesión deja de contar', async () => {
    const store = memoryStore(twoCycles());
    await sdd.bindFromCommand(store, ROOT, session, 'pnpm sdd:use x', 'SDD-BIND spec=spec-x-001-a cycle=cycle-01');
    const touched = await sdd.touchSession(store, ROOT, { id: 'sess-1', now: NOW + 5000 });
    expect(touched?.updated_at).toBe(new Date(NOW + 5000).toISOString());
    const ended = await sdd.endSession(store, ROOT, { id: 'sess-1', now: NOW + 6000 });
    expect(ended?.ended_at).toBe(new Date(NOW + 6000).toISOString());
    const after = await sdd.loadSnapshot(store, ROOT, { id: 'sess-9', now: NOW + 7000 });
    expect(after.others).toEqual([]);
  });

  it('si el registro no se puede escribir, el snapshot lo marca y el gate deja pasar', async () => {
    const files = twoCycles();
    delete files['/repo/sdd/specs/spec-x-002-b/cycles/cycle-01/cycle.json'];
    const store = memoryStore(files);
    const readOnly: Store = {
      ...store,
      write: async () => {
        throw new Error('EROFS');
      },
    };
    const snap = await sdd.loadSnapshot(readOnly, ROOT, session);
    expect(snap.error).toBeUndefined();
    expect(snap.registryError).toContain('EROFS');
    expect(snap.openUnits).toHaveLength(1);
    expect(sdd.judgeEdit(snap, ROOT, 'src/a.ts', NOW).kind).toBe('allow');
  });
});

describe('sdd-mod: copia del registro de sesiones', () => {
  it('la copia dentro del mod es idéntica a scripts/lib/session-registry.mjs', () => {
    const kit = resolve(__dirname, '../../../templates/sdd');
    const lib = readFileSync(resolve(kit, 'scripts/lib/session-registry.mjs'), 'utf8');
    const copy = readFileSync(resolve(kit, 'skills/sdd-mod/hooks/.src/session-registry.mjs'), 'utf8');
    expect(copy).toBe(lib);
  });
});
