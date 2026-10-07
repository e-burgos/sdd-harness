import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';

// The mod's pure logic (templates/sdd/skills/sdd-mod/hooks/.src/sdd.ts) is loaded at run time: its
// type contract augments the 'claude-code' module, which only Claude Code provides, so tsc must
// not follow the import. The local types below mirror what the tests touch.
const SDD_TS = resolve(__dirname, '../../../templates/sdd/skills/sdd-mod/hooks/.src/sdd.ts');

type Snapshot = {
  settings: { enabled: boolean; gate: 'block' | 'warn' };
  cycles: { spec: string; cycle: string; flow: string; tasks: { status: string }[] }[];
  fixes: { id: string; status: string }[];
  error?: string;
};
type Reader = {
  read: (path: string) => Promise<string>;
  list: (path: string) => Promise<{ name: string; kind: string }[]>;
};
type SddModule = {
  readSettings: (tools: unknown) => Snapshot['settings'];
  relativeToRoot: (root: string, filePath: string) => string | null;
  isCodePath: (rel: string) => boolean;
  judgeEdit: (s: Snapshot, root: string, filePath: string) => { kind: string; reason?: string };
  loadSnapshot: (reader: Reader, root: string) => Promise<Snapshot>;
  bandLine: (s: Snapshot) => string | null;
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
    ...partial,
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

  it('un ciclo in-progress o un fix abierto habilitan; un error de lectura no bloquea', () => {
    const cycle = { spec: 'spec-x-001-a', cycle: 'cycle-01', flow: 'lite', tasks: [] };
    expect(sdd.judgeEdit(snapshot({ cycles: [cycle] }), ROOT, 'src/a.ts').kind).toBe('allow');
    const fix = { id: 'FIX-x-001', status: 'pending' };
    expect(sdd.judgeEdit(snapshot({ fixes: [fix] }), ROOT, 'src/a.ts').kind).toBe('allow');
    expect(sdd.judgeEdit(snapshot({ error: 'boom' }), ROOT, 'src/a.ts').kind).toBe('allow');
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
    expect(sdd.bandLine(result)).toBe(
      'SDD ▸ spec-x-001-a · cycle-02 · lite · 1/2 tareas · 1 fix abierto(s) · /sdd',
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
