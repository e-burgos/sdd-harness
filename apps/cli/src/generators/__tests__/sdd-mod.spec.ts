import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';

// The mod's pure logic (templates/sdd/skills/sdd-mod/hooks/.src/sdd.ts) is loaded at run time: its
// type contract augments the 'claude-code' module, which only Claude Code provides, so tsc must
// not follow the import. The local types below mirror what the tests touch.
const SDD_TS = resolve(__dirname, '../../../templates/sdd/skills/sdd-mod/hooks/.src/sdd.ts');

type Unit = { kind: 'cycle'; spec: string; cycle: string } | { kind: 'fix'; fix: string } | { kind: 'spec'; spec: string };
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
  settings: { enabled: boolean; gate: 'block' | 'warn'; exempt?: string[] };
  cycles: { spec: string; cycle: string; flow: string; tasks: { status: string }[] }[];
  fixes: { id: string; status: string }[];
  openUnits: Unit[];
  specs?: { spec: string; worktree: string }[];
  root?: string;
  worktrees?: string[];
  mine: Binding | null;
  others: Binding[];
  sessionId?: string;
  leases?: { path: string; session_id: string }[];
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
  isCodePath: (rel: string, exempt?: readonly string[]) => boolean;
  matchesGlob: (rel: string, glob: string) => boolean;
  judgeEdit: (s: Snapshot, root: string, filePath: string, now?: number) => { kind: string; reason?: string };
  loadSnapshot: (reader: Reader | Store, root: string, session?: Session) => Promise<Snapshot>;
  bandLine: (s: Snapshot) => string | null;
  outputText: (result: unknown) => string;
  bindFromCommand: (
    store: Store,
    root: string,
    session: Session,
    command: string,
    output: unknown,
  ) => Promise<{ bound: Unit; worktree: string } | { rejected: string } | null>;
  bindFromEdit: (store: Store, s: Snapshot, filePath: string, session: Session) => Promise<Unit | null>;
  touchSession: (store: Store, root: string, session: Session) => Promise<Binding | null>;
  endSession: (store: Store, root: string, session: Session) => Promise<Binding | null>;
  holderOf: (s: Snapshot, unit: Unit) => 'mine' | 'other' | null;
  leaseEdit: (
    store: Store,
    s: Snapshot,
    root: string,
    filePath: string,
    session: Session,
  ) => Promise<{ verdict: { kind: string; reason?: string }; request: { toSessionId: string; text: string } | null }>;
  unreadInbox: (store: Reader, root: string, session: Session) => Promise<{ id: string; path: string }[]>;
  markInboxSeen: (store: Store, root: string, session: Session, ids: string[]) => Promise<void>;
  inboxSection: (messages: { id: string; path: string }[]) => string | null;
  leasesOf: (s: Snapshot, sessionId: string) => { path: string }[];
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
    expect(sdd.readSettings(null)).toEqual({ enabled: false, gate: 'block', exempt: [] });
    expect(sdd.readSettings({ rtk: { enabled: true } })).toEqual({ enabled: false, gate: 'block', exempt: [] });
    expect(sdd.readSettings({ claude_mod: { enabled: true } })).toEqual({ enabled: true, gate: 'block', exempt: [] });
    expect(sdd.readSettings({ claude_mod: { enabled: 'yes', gate: 'warn' } })).toEqual({
      enabled: false,
      gate: 'warn',
      exempt: [],
    });
  });

  it('exempt: solo strings no vacíos; cualquier otra forma es lista vacía y nunca lanza', () => {
    const exemptOf = (exempt: unknown) =>
      sdd.readSettings({ claude_mod: { enabled: true, exempt } }).exempt;
    expect(exemptOf(['apps/docs/**/*.mdx', 'x/*.md'])).toEqual(['apps/docs/**/*.mdx', 'x/*.md']);
    expect(exemptOf(['a', 1, null, {}, '', 'b'])).toEqual(['a', 'b']);
    for (const bad of [undefined, null, 'apps/**', 5, true, { 0: 'a' }]) {
      expect(exemptOf(bad)).toEqual([]);
    }
    expect(sdd.readSettings('garbage').exempt).toEqual([]);
    expect(sdd.readSettings({ claude_mod: null }).exempt).toEqual([]);
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

  it('markdown fuera de apps|libs|tools no es código; el resto sí', () => {
    for (const rel of ['docs/prompts/x.md', 'docs/guide/a.mdx', 'README.mdx', 'sdd/anything', 'sdd/a/b.ts']) {
      expect(sdd.isCodePath(rel), rel).toBe(false);
    }
    for (const rel of ['docs/script.ts', 'apps/web/README.md', 'libs/a/doc.mdx', 'tools/x/y.md']) {
      expect(sdd.isCodePath(rel), rel).toBe(true);
    }
    expect(sdd.isCodePath('src/notes.md')).toBe(false);
    expect(sdd.isCodePath('docs\\prompts\\x.md')).toBe(false);
    expect(sdd.isCodePath('docs\\script.ts')).toBe(true);
    expect(sdd.isCodePath('apps\\web\\README.md')).toBe(true);
    expect(sdd.isCodePath('sdd\\anything')).toBe(false);
  });

  it('sin exempt, los veredictos de hoy no cambian', () => {
    const table: [string, boolean][] = [
      ['apps/a/src/x.ts', true],
      ['apps/a/README.md', true],
      ['apps/a/pages/p.mdx', true],
      ['libs/l/index.ts', true],
      ['libs/l/CHANGELOG.md', true],
      ['tools/t/run.mjs', true],
      ['tools/t/NOTES.md', true],
      ['src/a.ts', true],
      ['package.json', true],
      ['Dockerfile', true],
      ['scripts/build.sh', true],
      ['docs/script.ts', true],
      ['sdd/fixes.json', false],
      ['sdd/specs/x/brief.yaml', false],
      ['.claude/settings.json', false],
      ['.github/workflows/ci.yml', false],
      ['.gemini/settings.json', false],
      ['.agents/skills/a.md', false],
      ['.agent/x', false],
      ['.vscode/mcp.json', false],
      ['.idea/x.xml', false],
      ['README.md', false],
      ['CHANGELOG.MD', false],
    ];
    for (const [rel, code] of table) {
      expect(sdd.isCodePath(rel), rel).toBe(code);
      expect(sdd.isCodePath(rel, []), rel).toBe(code);
    }
  });

  it('exempt saca de código lo que matchea y nada más', () => {
    const exempt = ['apps/docs/**/*.mdx'];
    expect(sdd.isCodePath('apps/docs/pages/a.mdx')).toBe(true);
    expect(sdd.isCodePath('apps/docs/pages/a.mdx', exempt)).toBe(false);
    expect(sdd.isCodePath('apps/docs/a.mdx', exempt)).toBe(false);
    expect(sdd.isCodePath('apps/docs/pages/a.tsx', exempt)).toBe(true);
    expect(sdd.isCodePath('apps/web/pages/a.mdx', exempt)).toBe(true);
    expect(sdd.isCodePath('src/a.ts', ['docs/**'])).toBe(true);
    expect(sdd.isCodePath('src/a.ts', ['src/*.ts'])).toBe(false);
    expect(sdd.isCodePath('apps\\docs\\pages\\a.mdx', exempt)).toBe(false);
  });

  it('CODE_ROOTS no distingue mayúsculas: Apps/ y APPS/ siguen siendo código', () => {
    expect(sdd.isCodePath('Apps/web/README.md')).toBe(true);
    expect(sdd.isCodePath('APPS/x.mdx')).toBe(true);
    expect(sdd.isCodePath('Libs/a/b.md')).toBe(true);
    expect(sdd.isCodePath('Docs/a.md')).toBe(false);
  });

  it('** pegado a otros caracteres no cruza /', () => {
    expect(sdd.isCodePath('apps/docs-api/src/server.ts', ['apps/docs**'])).toBe(true);
    expect(sdd.matchesGlob('apps/docs-api', 'apps/docs**')).toBe(true);
    expect(sdd.matchesGlob('apps/docs-api/x', 'apps/docs**')).toBe(false);
    expect(sdd.matchesGlob('a/b/c.md', 'a/**.md')).toBe(false);
    expect(sdd.matchesGlob('a/b.md', 'a/**.md')).toBe(true);
    expect(sdd.matchesGlob('a/b/c.md', '**/**/c.md')).toBe(true);
  });

  it('muchos ** no explotan: 12 segmentos ** contra un path de 200 caracteres en menos de 50 ms', () => {
    const glob = Array.from({ length: 12 }, () => '**/a').join('/') + '/zzz';
    const path = Array.from({ length: 66 }, () => 'a').join('/') + '/b';
    const start = performance.now();
    expect(sdd.matchesGlob(path, glob)).toBe(false);
    expect(sdd.matchesGlob(path, '**/**/**/**/**/**/**/**/**/**/**/**/b')).toBe(true);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('globs: **, *, ? y metacaracteres literales', () => {
    const m = sdd.matchesGlob;
    expect(m('a/b/c.md', '**/c.md')).toBe(true);
    expect(m('c.md', '**/c.md')).toBe(true);
    expect(m('a/b/c.md', '**/*.md')).toBe(true);
    expect(m('a/x/y/b', 'a/**/b')).toBe(true);
    expect(m('a/b', 'a/**/b')).toBe(true);
    expect(m('a/xb', 'a/**/b')).toBe(false);
    expect(m('a/b/c/d', 'a/**')).toBe(true);
    expect(m('a/b', 'a/**')).toBe(true);
    expect(m('b/a', 'a/**')).toBe(false);
    expect(m('a/b.md', 'a/*.md')).toBe(true);
    expect(m('a/b/c.md', 'a/*.md')).toBe(false);
    expect(m('a/b/c.md', '*.md')).toBe(false);
    expect(m('a/bc', 'a/b?')).toBe(true);
    expect(m('a/b', 'a/b?')).toBe(false);
    expect(m('a/b/', 'a/b?')).toBe(false);
    expect(m('a/b.c', 'a/b.c')).toBe(true);
    expect(m('a/bxc', 'a/b.c')).toBe(false);
    expect(m('a/b+c', 'a/b+c')).toBe(true);
    expect(m('a/bbc', 'a/b+c')).toBe(false);
    expect(m('a/(x)', 'a/(x)')).toBe(true);
    expect(m('a/x', 'a/(x)')).toBe(false);
    expect(m('a/[x]', 'a/[x]')).toBe(true);
    expect(m('a/x', 'a/[x]')).toBe(false);
    expect(m('a/b', 'a/b|c')).toBe(false);
    expect(m('a/$b^', 'a/$b^')).toBe(true);
    expect(m('a/b/c.md', 'a\\**\\*.md')).toBe(true);
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
    expect(result.settings).toEqual({ enabled: true, gate: 'warn', exempt: [] });
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
    expect(await sdd.bindFromCommand(store, ROOT, session, 'pnpm sdd:gate x cycle-01', `APPROVED\n${marker}\n`)).toEqual({ bound: unit, worktree: ROOT });
    expect((await sdd.loadSnapshot(store, ROOT, session)).mine?.source).toBe('gate-b');
    expect(await sdd.bindFromCommand(store, ROOT, session, 'pnpm sdd:use x cycle-01', { stdout: `hi\n${marker}\n`, stderr: '' })).toEqual({ bound: unit, worktree: ROOT });
    expect((await sdd.loadSnapshot(store, ROOT, session)).mine?.source).toBe('sdd-use');

    expect(await sdd.bindFromCommand(store, ROOT, session, 'pnpm sdd:use x cycle-09', 'SDD-BIND spec=spec-x-001-a cycle=cycle-09')).toEqual({
      rejected: expect.stringContaining('spec-x-001-a/cycle-09'),
    });
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

describe('sdd-mod: type-check del mod', () => {
  it('el tsconfig lista cada fuente TypeScript de hooks/.src, porque tsc saltea carpetas con punto en include', () => {
    const mod = resolve(__dirname, '../../../templates/sdd/skills/sdd-mod');
    const config = JSON.parse(readFileSync(resolve(mod, 'tsconfig.json'), 'utf8')) as { files?: string[]; include?: string[] };
    const sources = readdirSync(resolve(mod, 'hooks/.src'))
      .filter((name) => /\.(tsx?|d\.mts)$/.test(name))
      .map((name) => `hooks/.src/${name}`);
    expect(config.files).toEqual(expect.arrayContaining([...sources, '.claude-plugin/contract/index.d.ts']));
    expect(config.include).toEqual(['.claude-plugin/types']);
  });
});

describe('sdd-mod: reservas de archivo y buzón', () => {
  const NOW = Date.parse('2026-11-06T12:00:00.000Z');
  const specIndex = {
    specs: [
      { id: 'spec-x-001-a', title: 'A', status: 'in-progress', folder: 'sdd/specs/spec-x-001-a' },
      { id: 'spec-x-002-b', title: 'B', status: 'in-progress', folder: 'sdd/specs/spec-x-002-b' },
    ],
  };
  const files = (): Record<string, unknown> => ({
    '/repo/sdd/tools.json': { claude_mod: { enabled: true, gate: 'block' } },
    '/repo/sdd/specs/index.json': specIndex,
    '/repo/sdd/specs/spec-x-001-a/cycles/cycle-01/cycle.json': { status: 'in-progress', flow: 'lite' },
    '/repo/sdd/specs/spec-x-001-a/cycles/cycle-01/tasks.json': { tasks: [] },
    '/repo/sdd/specs/spec-x-002-b/cycles/cycle-01/cycle.json': { status: 'in-progress', flow: 'lite' },
    '/repo/sdd/specs/spec-x-002-b/cycles/cycle-01/tasks.json': { tasks: [] },
  });
  const a: Session = { id: 'sess-a', now: NOW };
  const b: Session = { id: 'sess-b', now: NOW + 1000 };

  async function boundPair() {
    const store = memoryStore(files());
    await sdd.bindFromCommand(store, ROOT, a, 'pnpm sdd:use a 1', 'SDD-BIND spec=spec-x-001-a cycle=cycle-01');
    await sdd.bindFromCommand(store, ROOT, b, 'pnpm sdd:use b 1', 'SDD-BIND spec=spec-x-002-b cycle=cycle-01');
    const snapOf = (session: Session) => sdd.loadSnapshot(store, ROOT, session);
    return { store, snapOf };
  }

  it('la primera sesión reserva el archivo y la segunda, en la misma carpeta, queda frenada con pedido', async () => {
    const { store, snapOf } = await boundPair();
    const first = await sdd.leaseEdit(store, await snapOf(a), ROOT, '/repo/src/auth.ts', a);
    expect(first).toEqual({ verdict: { kind: 'allow' }, request: null });
    const second = await sdd.leaseEdit(store, await snapOf(b), ROOT, 'src/auth.ts', b);
    expect(second.verdict.kind).toBe('deny');
    expect(second.verdict.reason).toContain('spec-x-001-a/cycle-01');
    expect(second.request).toMatchObject({ toSessionId: 'sess-a' });
    expect(second.request?.text).toContain('spec-x-002-b/cycle-01 necesita src/auth.ts');
    const retry = await sdd.leaseEdit(store, await snapOf(b), ROOT, 'src/auth.ts', b);
    expect(retry.verdict.kind).toBe('deny');
    expect(retry.request).toBeNull();
    expect(sdd.leasesOf(await snapOf(a), 'sess-a').map((l) => l.path)).toEqual(['src/auth.ts']);
  });

  it('la dueña ve el pedido en su buzón una vez y al cerrar la sesión libera el archivo', async () => {
    const { store, snapOf } = await boundPair();
    await sdd.leaseEdit(store, await snapOf(a), ROOT, 'src/auth.ts', a);
    await sdd.leaseEdit(store, await snapOf(b), ROOT, 'src/auth.ts', b);
    const inbox = await sdd.unreadInbox(store, ROOT, a);
    expect(sdd.inboxSection(inbox)).toContain('pnpm sdd:release src/auth.ts');
    await sdd.markInboxSeen(store, ROOT, a, inbox.map((m) => m.id));
    expect(sdd.inboxSection(await sdd.unreadInbox(store, ROOT, a))).toBeNull();
    await sdd.endSession(store, ROOT, { id: 'sess-a', now: NOW + 2000 });
    const after = await sdd.leaseEdit(store, await snapOf({ id: 'sess-b', now: NOW + 3000 }), ROOT, 'src/auth.ts', {
      id: 'sess-b',
      now: NOW + 3000,
    });
    expect(after.verdict.kind).toBe('allow');
  });

  it('no reserva archivos que no son código y solo avisa en modo warn', async () => {
    const { store, snapOf } = await boundPair();
    await sdd.leaseEdit(store, await snapOf(a), ROOT, 'sdd/specs/x.md', a);
    expect(sdd.leasesOf(await snapOf(a), 'sess-a')).toEqual([]);
    await sdd.leaseEdit(store, await snapOf(a), ROOT, 'src/x.ts', a);
    const warnSnap = { ...(await snapOf(b)), settings: { enabled: true, gate: 'warn' as const } };
    expect((await sdd.leaseEdit(store, warnSnap, ROOT, 'src/x.ts', b)).verdict.kind).toBe('warn');
  });
});

describe('sdd-mod: worktrees y unidad de la sesión', () => {
  const NOW = Date.parse('2026-11-17T12:00:00.000Z');
  const session: Session = { id: 'sess-w', now: NOW };
  const ARCA = '/wt/arca';
  const TOOLS = { claude_mod: { enabled: true, gate: 'block' } };
  const spec = (id: string, status: string) => ({ id, title: id, status, folder: `sdd/specs/${id}` });
  const cycle48 = { kind: 'cycle', spec: 'spec-x-048-facturacion-arca', cycle: 'cycle-01' } as const;

  const repo = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    '/repo/.git/HEAD': 'ref: refs/heads/main\n',
    '/repo/.git/worktrees/arca/gitdir': `${ARCA}/.git\n`,
    '/repo/.git/worktrees/arca/commondir': '../..\n',
    '/repo/.git/worktrees/arca/HEAD': 'ref: refs/heads/feat/facturacion-arca\n',
    [`${ARCA}/.git`]: 'gitdir: /repo/.git/worktrees/arca\n',
    '/repo/sdd/tools.json': TOOLS,
    '/repo/sdd/specs/index.json': { specs: [spec('spec-x-047-cotizaciones', 'completed')] },
    [`${ARCA}/sdd/tools.json`]: TOOLS,
    [`${ARCA}/sdd/specs/index.json`]: {
      specs: [spec('spec-x-048-facturacion-arca', 'in-progress'), spec('spec-x-049-portal', 'draft')],
    },
    [`${ARCA}/sdd/specs/spec-x-048-facturacion-arca/cycles/cycle-01/cycle.json`]: { status: 'in-progress', flow: 'full' },
    [`${ARCA}/sdd/specs/spec-x-048-facturacion-arca/cycles/cycle-01/tasks.json`]: { tasks: [] },
    [`${ARCA}/sdd/specs/spec-x-049-portal/spec-x-049-portal.spec.md`]: '# 049',
    ...extra,
  });

  it('ve las unidades de otro worktree, ata la única y la franja dice dónde trabaja', async () => {
    const store = memoryStore(repo());
    const snap = await sdd.loadSnapshot(store, ROOT, session);
    expect(snap.worktrees).toEqual(['/repo', ARCA]);
    expect(snap.openUnits).toEqual([cycle48]);
    expect(snap.mine?.unit).toEqual(cycle48);
    expect(snap.mine?.worktree).toBe(ARCA);
    expect(snap.specs?.map((s) => s.spec)).toEqual(['spec-x-049-portal']);
    expect(sdd.bandLine(snap)).toContain('esta sesión: spec-x-048-facturacion-arca · cycle-01 · full · 0/0 · en arca');
  });

  it('el gate juzga el archivo contra su worktree: código en otro worktree sin unidad no pasa', () => {
    const empty = snapshot({ root: ROOT, worktrees: ['/repo', ARCA], openUnits: [] });
    expect(sdd.judgeEdit(empty, ROOT, `${ARCA}/src/a.ts`, NOW).kind).toBe('deny');
    expect(sdd.judgeEdit(empty, ROOT, '/elsewhere/a.ts', NOW).kind).toBe('allow');
  });

  it('la marca con worktree ata contra ese worktree; sin worktree se rechaza con el motivo', async () => {
    const store = memoryStore(repo({ '/repo/sdd/fixes.json': { fixes: [{ id: 'FIX-x-001', status: 'pending', title: 'f', type: 'improvement' }] } }));
    const plain = 'SDD-BIND spec=spec-x-048-facturacion-arca cycle=cycle-01';
    expect(await sdd.bindFromCommand(store, ROOT, session, 'pnpm sdd:use 048 cycle-01', plain)).toEqual({
      rejected: expect.stringContaining('/repo'),
    });
    const marker = `${plain} worktree=${encodeURIComponent(ARCA)}`;
    expect(await sdd.bindFromCommand(store, ROOT, session, 'cd /wt/arca && pnpm sdd:use 048 cycle-01', marker)).toEqual({
      bound: cycle48,
      worktree: ARCA,
    });
    const snap = await sdd.loadSnapshot(store, ROOT, session);
    expect(snap.mine?.source).toBe('sdd-use');
    expect(sdd.bandLine(snap)).toContain('· en arca');
    await sdd.bindFromCommand(store, ROOT, session, 'pnpm sdd:use FIX-x-001', 'SDD-BIND fix=FIX-x-001');
    expect(sdd.bandLine(await sdd.loadSnapshot(store, ROOT, session))).toContain('esta sesión: FIX-x-001 · improvement ·');
  });

  it('una spec sin ciclo se puede atar, no autoriza código y sube sola al ciclo cuando se abre', async () => {
    const files = repo();
    const store = memoryStore(files);
    const marker = `SDD-BIND spec=spec-x-049-portal worktree=${encodeURIComponent(ARCA)}`;
    expect(await sdd.bindFromCommand(store, ROOT, session, 'pnpm sdd:gate 049', marker)).toEqual({
      bound: { kind: 'spec', spec: 'spec-x-049-portal' },
      worktree: ARCA,
    });
    const preparing = await sdd.loadSnapshot(store, ROOT, session);
    expect(preparing.mine?.source).toBe('gate-a');
    expect(sdd.bandLine(preparing)).toContain('esta sesión: spec-x-049-portal · preparando la spec · en arca');
    const verdict = sdd.judgeEdit(preparing, ROOT, `${ARCA}/src/a.ts`, NOW);
    expect(verdict.kind).toBe('deny');
    expect(verdict.reason).toContain('preparando spec-x-049-portal');

    files[`${ARCA}/sdd/specs/spec-x-049-portal/cycles/cycle-01/cycle.json`] = { status: 'in-progress', flow: 'lite' };
    const opened = await sdd.loadSnapshot(store, ROOT, session);
    expect(opened.mine?.unit).toEqual({ kind: 'cycle', spec: 'spec-x-049-portal', cycle: 'cycle-01' });
    expect(opened.mine?.source).toBe('spec-cycle');
  });

  it('escribir un documento de la spec o del ciclo ata la sesión aunque haya varias unidades', async () => {
    const files = repo({
      [`${ARCA}/sdd/specs/spec-x-049-portal/cycles/cycle-01/cycle.json`]: { status: 'in-progress', flow: 'lite' },
    });
    const store = memoryStore(files);
    const before = await sdd.loadSnapshot(store, ROOT, session);
    expect(before.openUnits).toHaveLength(2);
    expect(before.mine).toBeNull();
    const doc = `${ARCA}/sdd/specs/spec-x-048-facturacion-arca/cycles/cycle-01/functional.md`;
    expect(await sdd.bindFromEdit(store, before, doc, session)).toEqual(cycle48);
    const after = await sdd.loadSnapshot(store, ROOT, session);
    expect(after.mine?.source).toBe('document');
    expect(sdd.judgeEdit(after, ROOT, `${ARCA}/src/a.ts`, NOW).kind).toBe('allow');
  });

  it('código en un worktree con una sola unidad ata a esa unidad', async () => {
    const files = repo({
      '/repo/sdd/fixes.json': { fixes: [{ id: 'FIX-x-002', status: 'in-progress', title: 'f', type: 'bugfix' }] },
    });
    const store = memoryStore(files);
    const before = await sdd.loadSnapshot(store, ROOT, session);
    expect(before.mine).toBeNull();
    expect(await sdd.bindFromEdit(store, before, `${ARCA}/src/a.ts`, session)).toEqual(cycle48);
    expect(await sdd.bindFromEdit(store, before, '/repo/src/a.ts', session)).toEqual({ kind: 'fix', fix: 'FIX-x-002' });
  });
});
