import { describe, it, expect, beforeAll } from 'vitest';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Heading = { level: number; text: string; line: number; end: number };
type Io = { read(path: string): Buffer | null; list(path: string): { name: string; dir: boolean }[] };
type Ctx = { get(selector: string): string; unresolved: string[]; trailers: unknown[] };
type Lib = {
  splitLines(text: string | Buffer): string[];
  parseHeadings(lines: string[]): Heading[];
  normalizeHeading(value: string): string;
  headingId(text: string): string | null;
  resolveToken(headings: Heading[], token: string): { heading?: Heading; reason?: string };
  expandRanges(text: string): string[];
  rangeProblems(text: string): string[];
  resolveWithParents(headings: Heading[], token: string): { heading?: Heading; reason?: string };
  parentIds(id: string): string[];
  mentionsPath(text: string, path: string): boolean;
  isInsideSdd(path: string): boolean;
  isSafeApp(app: unknown): boolean;
  maskedLines(lines: string[]): Set<number>;
  mentionedIds(text: string, known: Set<string>): Set<string>;
  parseSelector(raw: string): { kind: string };
  parseUnitArg(raw: string): { kind?: string; id?: string; ids?: string[]; error?: string };
  resolveUnit(tasksJson: object, request: object): { unit?: { id: string; taskIds: string[]; app: string | null }; error?: string };
  resolveApp(input: object): { app?: string | null; error?: string; candidates?: string[] };
  createContext(input: object): Ctx;
  buildPack(input: { ctx: Ctx; role: string; include: string[] }): {
    text: string;
    packBytes: number;
    sourceBytes: number;
    oversize: boolean;
    unresolved: string[];
  };
  statsUnits(input: object): { id: string }[];
  topPackMisses(tasks: object[]): { path: string; count: number }[];
  unresolvedExplicitRefs(io: Io, cycleDir: string): { task: string; ref: string }[];
};

const kitRoot = resolve(__dirname, '../../../templates/sdd/scripts/lib');
let lib: Lib;

beforeAll(async () => {
  lib = (await import(pathToFileURL(join(kitRoot, 'pack.mjs')).href)) as Lib;
});

const headings = (text: string) => lib.parseHeadings(lib.splitLines(text));

describe('pack.mjs heading model', () => {
  it('ignores headings inside fenced code and keeps ranges to the next heading of equal or higher level', () => {
    const found = headings(['# A', 'x', '```md', '## fake', '```', '## B', 'y', '~~~~', '# fake', '~~~~', '## C', '# D'].join('\n'));
    expect(found.map((h) => h.text)).toEqual(['A', 'B', 'C', 'D']);
    expect(found[0]).toMatchObject({ line: 1, end: 11 });
    expect(found[1]).toMatchObject({ line: 6, end: 10 });
    expect(found[3]).toMatchObject({ line: 12, end: 12 });
  });

  it('survives CRLF, BOM, closing hashes, empty and missing documents', () => {
    const found = headings('﻿# Title ##\r\n\r\n## Sub\r\ntext\r\n');
    expect(found.map((h) => h.text)).toEqual(['Title', 'Sub']);
    expect(found[1]).toMatchObject({ line: 3, end: 4 });
    expect(headings('')).toEqual([]);
    expect(lib.splitLines('')).toEqual([]);
  });

  it('trims trailing blank lines out of a section range', () => {
    const found = headings('## A\nbody\n\n\n## B\nx');
    expect(found[0]).toMatchObject({ line: 1, end: 2 });
  });

  it('extracts ids only from the id-shaped first token', () => {
    expect(lib.headingId('D-04. Enlazado')).toBe('D-04');
    expect(lib.headingId('US-2-001: Instalar')).toBe('US-2-001');
    expect(lib.headingId('RN-12 regla')).toBe('RN-12');
    expect(lib.headingId('Contexto de negocio')).toBeNull();
    expect(lib.headingId('D-041x')).toBeNull();
  });
});

describe('pack.mjs token resolution', () => {
  const docHeadings = () => headings(
    ['### D-041. Otra', '### D-04. Enlazado de la skill', '### 3.4 Template: functional', '### 3.4.1 Sub', '### 3.3b Template', '## ⛔ CONTEXTO GATE — regla global', '## Protocolo del implementador', '## Dos veces', '## Dos veces más', '## Única cosa rara'].join('\n'),
  );

  it('matches a prefix only when followed by a non-word character (D-04 is not D-041)', () => {
    const doc = docHeadings();
    expect(lib.resolveToken(doc, 'D-04').heading?.text).toBe('D-04. Enlazado de la skill');
    expect(lib.resolveToken(doc, 'D-041').heading?.text).toBe('D-041. Otra');
    expect(lib.resolveToken(doc, '3.4').heading?.text).toBe('3.4 Template: functional');
    expect(lib.resolveToken(doc, '3.3b').heading?.text).toBe('3.3b Template');
    expect(lib.resolveToken(doc, '3.9')).toMatchObject({ reason: 'not found' });
  });

  it('falls back to normalized equality, then to a single containing candidate', () => {
    const doc = docHeadings();
    expect(lib.resolveToken(doc, 'protocolo del IMPLEMENTADOR').heading?.text).toBe('Protocolo del implementador');
    expect(lib.resolveToken(doc, 'CONTEXTO GATE').heading?.text).toContain('CONTEXTO GATE');
    expect(lib.resolveToken(doc, 'cosa rara').heading?.text).toBe('Única cosa rara');
    expect(lib.resolveToken(doc, 'veces')).toMatchObject({ reason: 'ambiguous' });
    expect(lib.resolveToken(doc, 'inexistente')).toMatchObject({ reason: 'not found' });
  });

  it('normalizes accents and punctuation', () => {
    expect(lib.normalizeHeading('Ñandú — ¡Régla!')).toBe('nandu regla');
  });
});

describe('pack.mjs derived refs', () => {
  it('expands ranges with the width of the first id and ignores inverted ones', () => {
    expect(lib.expandRanges('ver D-01..D-03 y RN-9..11 y X-5..2')).toEqual(['D-01', 'D-02', 'D-03', 'RN-09', 'RN-10', 'RN-11']);
  });

  it('finds whole-token mentions of known ids, never prefixes of longer ids', () => {
    const known = new Set(['D-04', 'D-041', 'US-2', 'US-2-001', 'D-01', 'D-02', 'D-03']);
    const found = lib.mentionedIds('Decisión D-04, también US-2-001. Rango D-01..D-03 y D-0411', known);
    expect([...found].sort()).toEqual(['D-01', 'D-02', 'D-03', 'D-04', 'US-2-001']);
  });
});

describe('pack.mjs arguments', () => {
  it('parses selectors', () => {
    expect(lib.parseSelector('section:dual-harness/rules/x.md#A B#C')).toMatchObject({ kind: 'section', path: 'dual-harness/rules/x.md', token: 'A B#C' });
    expect(lib.parseSelector('registry:api@unit').kind).toBe('registry-unit');
    expect(lib.parseSelector('registry:components@app:index')).toMatchObject({ kind: 'registry', index: true });
    expect(lib.parseSelector('context:@app:index')).toMatchObject({ kind: 'context', index: true });
    expect(lib.parseSelector('nonsense').kind).toBe('invalid');
    expect(lib.parseSelector('section:nohash').kind).toBe('invalid');
  });

  it('parses units and resolves them against tasks.json', () => {
    expect(lib.parseUnitArg('B-01')).toEqual({ kind: 'batch', id: 'B-01' });
    expect(lib.parseUnitArg('TASK-002,TASK-001,TASK-002')).toEqual({ kind: 'tasks', ids: ['TASK-002', 'TASK-001'] });
    expect(lib.parseUnitArg('nope').error).toContain('invalid unit');
    const tasksJson = { tasks: [{ id: 'TASK-001' }, { id: 'TASK-002' }], batches: [{ id: 'B-01', app: 'apps/a', role: 'r', tasks: ['TASK-002', 'TASK-001'] }] };
    expect(lib.resolveUnit(tasksJson, { kind: 'batch', id: 'B-01' }).unit).toMatchObject({ taskIds: ['TASK-001', 'TASK-002'], app: 'apps/a' });
    expect(lib.resolveUnit(tasksJson, { kind: 'tasks', ids: ['TASK-002', 'TASK-001'] }).unit?.id).toBe('TASK-001+TASK-002');
    expect(lib.resolveUnit(tasksJson, { kind: 'batch', id: 'B-09' }).error).toContain('B-09');
    expect(lib.resolveUnit(tasksJson, { kind: 'tasks', ids: ['TASK-009'] }).error).toContain('TASK-009');
  });

  it('decides the app from --app, the block or the only cycle app, and lists candidates otherwise', () => {
    expect(lib.resolveApp({ requested: 'apps/b', unitApp: 'apps/a', cycleApps: ['apps/a', 'apps/b'] }).app).toBe('apps/b');
    expect(lib.resolveApp({ requested: 'apps/z', cycleApps: ['apps/a'] }).error).toContain('apps/a');
    expect(lib.resolveApp({ unitApp: 'apps/a', cycleApps: ['apps/a', 'apps/b'] }).app).toBe('apps/a');
    expect(lib.resolveApp({ cycleApps: ['apps/a'] }).app).toBe('apps/a');
    expect(lib.resolveApp({ cycleApps: ['apps/a', 'apps/b'] })).toEqual({ app: null, candidates: ['apps/a', 'apps/b'] });
  });
});

const SPEC = 'spec-u-001-demo';
const CYCLE_DIR = `sdd/specs/${SPEC}/cycles/cycle-01`;

function fakeIo(files: Record<string, string>): Io {
  return {
    read: (path) => (path in files ? Buffer.from(files[path], 'utf8') : null),
    list: (path) => {
      const prefix = `${path}/`;
      const seen = new Map<string, boolean>();
      for (const file of Object.keys(files)) {
        if (!file.startsWith(prefix)) continue;
        const rest = file.slice(prefix.length);
        const slash = rest.indexOf('/');
        seen.set(slash < 0 ? rest : rest.slice(0, slash), slash >= 0);
      }
      return [...seen.entries()].map(([name, dir]) => ({ name, dir }));
    },
  };
}

const tasks = {
  spec: SPEC,
  cycle: 1,
  tasks: [
    { id: 'TASK-001', title: 'One', user_stories: ['US-1-001'], story_points: 3, status: 'done', files: ['a.ts'], usage: { tokens_in: 1 }, refs: ['architect#D-02', 'architect#D-99'] },
    { id: 'TASK-002', title: 'Two', user_stories: [], story_points: 2, status: 'pending', files: [], depends_on: [] },
  ],
  batches: [{ id: 'B-01', app: 'apps/api', role: 'implementor-back', tasks: ['TASK-001', 'TASK-002'] }],
};

const baseFiles = (): Record<string, string> => ({
  [`${CYCLE_DIR}/cycle.json`]: JSON.stringify({ spec: SPEC, cycle: 1, flow: 'full', apps: ['apps/api'], objectives: ['Ship it'] }),
  [`${CYCLE_DIR}/tasks.json`]: JSON.stringify(tasks),
  [`${CYCLE_DIR}/brief.yaml`]: 'cycle: 1\nobjective: |\n  Do the thing\n  well.\n\nscope:\n  - one\n  - two\nout_of_scope:\n  - nothing\n# trailing comment\n',
  [`${CYCLE_DIR}/planner.md`]: '## Plan\n\n### TASK-001: One\nUses D-01..D-03 and US-1-001 and /orders/{id}.\n\n```md\n## not a heading\n```\n\n### TASK-002: Two\nNothing.\n\n### TASK-0011: Eleven\n',
  [`${CYCLE_DIR}/architect.md`]: '# Arch\n\n### D-01. First\nfirst body\n\n### D-02. Second\nsecond body\n\n### D-03. Third\nthird body\n\n### D-04. Fourth\nnot referenced\n\n### D-041. Other\nno\n',
  [`${CYCLE_DIR}/functional.md`]: '# Func\n\n### US-1-001: Story\ntext\n\n- [ ] CA-001: criterion one\n- [x] CA-002: criterion two\n\n### US-1-002: Other\n\n- [ ] CA-003: three\n',
  [`sdd/specs/${SPEC}/${SPEC}.spec.md`]: '# Spec\nbody\n',
  'sdd/context/apps/api/context_prompt.md': '# Prompt\nshort\n',
  'sdd/context/apps/api/constitution.md': '# Constitution\n\n## Stack\nnode\n\n## Reglas inviolables\nrule one\n\n## Historia larga\nlorem ipsum\n',
  'sdd/context/apps/api/updates/2026-01-02-b.md': 'second update\n',
  'sdd/context/apps/api/updates/2026-01-01-a.md': 'first update\n',
  'sdd/api.json': JSON.stringify({
    $schema: './schemas/api.schema.json',
    _comment: 'x',
    'apps/api': {
      endpoints: [
        { method: 'GET', path: '/orders/{id}', status: 'defined' },
        { method: 'POST', path: '/payments', status: 'defined' },
      ],
    },
  }),
  'sdd/schema.json': JSON.stringify({ api: { tables: [{ table: 'orders', status: 'defined' }] } }),
  'sdd/components.json': JSON.stringify({ 'apps/web': { components: [{ name: 'Button', status: 'implemented' }] } }),
  'sdd/verify.json': JSON.stringify({ 'apps/api': { quick: ['pnpm test {files}'], full: ['pnpm build'] } }),
  'sdd/dual-harness/rules/sdd-execution.md': '# Exec\n\n## Protocolo del implementador\nstep 1\n\n## Otra\nz\n',
  [`${CYCLE_DIR}/artifacts/verify/apps-api/B-01-full.json`]: JSON.stringify({ app: 'apps/api', level: 'full', unit: 'B-01', ok: true, commit: 'abcdef1234', duration_ms: 65000 }),
  [`${CYCLE_DIR}/artifacts/verify/logs/ignored.json`]: '{}',
});

const NOW = '2026-11-17T00:00:00.000Z';

function pack(files: Record<string, string>, include: string[], opts: { unit?: object; app?: string | null; limits?: object } = {}) {
  const unit = opts.unit ?? { id: 'B-01', kind: 'batch', taskIds: ['TASK-001', 'TASK-002'], app: 'apps/api' };
  const ctx = lib.createContext({
    io: fakeIo(files),
    specId: SPEC,
    specFolder: `sdd/specs/${SPEC}`,
    cycleId: 'cycle-01',
    cycleDir: CYCLE_DIR,
    unit,
    app: opts.app === undefined ? 'apps/api' : opts.app,
    limits: opts.limits,
    contextAlways: undefined,
    now: NOW,
  });
  return { ctx, result: lib.buildPack({ ctx, role: 'implementor-back', include }) };
}

describe('pack.mjs selectors', () => {
  it('cycle: json facts plus the raw brief blocks, comments excluded', () => {
    const { result } = pack(baseFiles(), ['cycle']);
    expect(result.text).toContain('- apps: apps/api');
    expect(result.text).toContain('  - Ship it');
    expect(result.text).toContain('objective: |\n  Do the thing\n  well.');
    expect(result.text).toContain('scope:\n  - one\n  - two');
    expect(result.text).toContain('out_of_scope:\n  - nothing');
    expect(result.text).not.toContain('trailing comment');
  });

  it('tasks:@unit drops usage; tasks:@all:summary is one line per task', () => {
    const { result } = pack(baseFiles(), ['tasks:@unit', 'tasks:@all:summary']);
    expect(result.text).not.toContain('tokens_in');
    expect(result.text).toContain('- TASK-001 · done · 3 SP · One · 1 files');
    expect(result.text).toContain('- TASK-002 · pending · 2 SP · Two · 0 files');
  });

  it('plan:@unit takes the section of each task (TASK-001 is not TASK-0011) and ignores fenced headings', () => {
    const { result } = pack(baseFiles(), ['plan:@unit']);
    expect(result.text).toContain('### TASK-001: One');
    expect(result.text).toContain('## not a heading');
    expect(result.text).toContain('### TASK-002: Two');
    expect(result.text).not.toContain('TASK-0011');
    const missing = pack(baseFiles(), ['plan:@unit'], { unit: { id: 'TASK-009', kind: 'tasks', taskIds: ['TASK-009'], app: null } });
    expect(missing.result.text).toContain('(sin fuente: sdd/specs/spec-u-001-demo/cycles/cycle-01/planner.md sin sección de TASK-009)');
  });

  it('plan:@unit in lite flow brings plan.md whole', () => {
    const files = baseFiles();
    files[`${CYCLE_DIR}/cycle.json`] = JSON.stringify({ spec: SPEC, flow: 'lite', apps: ['apps/api'] });
    files[`${CYCLE_DIR}/plan.md`] = '# Plan\nall of it\n';
    const { result } = pack(files, ['plan:@unit']);
    expect(result.text).toContain('all of it');
    expect(result.text).toContain('plan.md#L1-L2');
  });

  it('refs:@unit unions explicit and derived refs, expands ranges, dedupes and keeps document order', () => {
    const { result, ctx } = pack(baseFiles(), ['refs:@unit']);
    const text = ctx.get('refs:@unit');
    const order = ['D-01.', 'D-02.', 'D-03.', 'US-1-001:'].map((token) => text.indexOf(token));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order]).toEqual([...order].sort((a, b) => a - b));
    expect(text.match(/### D-02\./g)).toHaveLength(1);
    expect(text).not.toContain('D-04.');
    expect(text).not.toContain('US-1-002');
    expect(result.unresolved).toEqual(['architect#D-99']);
    expect(result.text).toContain('> Refs sin resolver: architect#D-99');
    expect(result.text).toContain('Índice de architect.md (refs sin resolver)');
  });

  it('refs:@unit falls back to the index of a document the unit never references', () => {
    const files = baseFiles();
    files[`${CYCLE_DIR}/planner.md`] = '### TASK-001: One\nnothing cited\n\n### TASK-002: Two\n';
    files[`${CYCLE_DIR}/tasks.json`] = JSON.stringify({ ...tasks, tasks: tasks.tasks.map((task) => ({ ...task, refs: undefined, user_stories: [] })) });
    const { result } = pack(files, ['refs:@unit']);
    expect(result.text).toContain('leé solo lo que necesites con offset/limit');
    expect(result.text).toContain('- L3-L4 · ### D-01. First');
  });

  it('refs:@unit in a lite cycle without architect or functional says so', () => {
    const files = baseFiles();
    delete files[`${CYCLE_DIR}/architect.md`];
    delete files[`${CYCLE_DIR}/functional.md`];
    const { result } = pack(files, ['refs:@unit']);
    expect(result.text).toContain('(sin fuente: el ciclo no tiene architect.md ni functional.md)');
  });

  it('context:@app inlines a small constitution and appends updates in name order', () => {
    const { result } = pack(baseFiles(), ['context:@app']);
    expect(result.text).toContain('## Historia larga');
    expect(result.text.indexOf('first update')).toBeLessThan(result.text.indexOf('second update'));
  });

  it('context:@app over the inline limit brings the index, the always-sections and the updates', () => {
    const { result } = pack(baseFiles(), ['context:@app'], { limits: { context_inline_max_bytes: 20 } });
    expect(result.text).toContain('- L3-L4 · ## Stack');
    expect(result.text).toContain('## Stack\nnode');
    expect(result.text).toContain('## Reglas inviolables\nrule one');
    expect(result.text).not.toContain('lorem ipsum\n\n# [');
    expect(result.text.split('lorem ipsum').length - 1).toBe(0);
    expect(result.text).toContain('first update');
  });

  it('context:@app:index is the prompt plus the constitution index only', () => {
    const { result } = pack(baseFiles(), ['context:@app:index']);
    expect(result.text).toContain('# Prompt');
    expect(result.text).toContain('- L1-L10 · # Constitution');
    expect(result.text).not.toContain('rule one');
    expect(result.text).not.toContain('first update');
  });

  it('registry:api@unit keeps endpoints whose path is in the unit text and falls back to the index', () => {
    const matching = pack(baseFiles(), ['tasks:@unit', 'plan:@unit', 'refs:@unit', 'registry:api@unit']).result.text;
    expect(matching).toContain('"path": "/orders/{id}"');
    expect(matching).not.toContain('"path": "/payments"');
    const fallback = pack(baseFiles(), ['registry:api@unit'], { unit: { id: 'TASK-002', kind: 'tasks', taskIds: ['TASK-002'], app: null } }).result.text;
    expect(fallback).toContain('- GET /orders/{id} · defined');
    expect(fallback).toContain('- POST /payments · defined');
  });

  it('registry selectors read the app key by id or bare name, and index mode is one line per entry', () => {
    const files = baseFiles();
    files['sdd/schema.json'] = JSON.stringify({ api: { tables: [{ table: 'orders', status: 'defined' }] } });
    const { result } = pack(files, ['registry:schema@app', 'registry:schema@app:index', 'registry:components@app:index'], { app: 'apps/api' });
    expect(result.text).toContain('"table": "orders"');
    expect(result.text).toContain('- orders · defined');
    expect(result.text).toContain('(sin fuente: sdd/components.json sin entradas para apps/api)');
  });

  it('verify:@app lists quick and full commands and the two usage lines', () => {
    const { result } = pack(baseFiles(), ['verify:@app']);
    expect(result.text).toContain('- quick: `pnpm test {files}`');
    expect(result.text).toContain('- full: `pnpm build`');
    expect(result.text).toContain('pnpm sdd:verify apps/api quick --files <a,b> --unit TASK-NNN');
    expect(result.text).toContain('pnpm sdd:verify apps/api full --unit B-NN');
  });

  it('verify-results gives one line per result file and skips logs', () => {
    const { result } = pack(baseFiles(), ['verify-results']);
    expect(result.text).toContain('- apps/api · B-01 · full · ok · abcdef1 ·');
    expect(result.text.split('\n').filter((line) => line.startsWith('- apps/api'))).toHaveLength(1);
  });

  it('acceptance reduces each story to its heading and criteria lines', () => {
    const { result } = pack(baseFiles(), ['acceptance']);
    expect(result.text).toContain('### US-1-001: Story\n- [ ] CA-001: criterion one\n- [x] CA-002: criterion two');
    expect(result.text).toContain('### US-1-002: Other\n- [ ] CA-003: three');
    expect(result.text).not.toContain('text\n');
  });

  it('index:, doc: and spec', () => {
    const { result } = pack(baseFiles(), ['index:architect', 'doc:functional', 'spec']);
    expect(result.text).toContain('- L3-L4 · ### D-01. First');
    expect(result.text).toContain('### US-1-002: Other');
    expect(result.text).toContain('# Spec\nbody');
  });

  it('section: extracts by token and reports a missing section or file without failing', () => {
    const { result } = pack(baseFiles(), [
      'section:dual-harness/rules/sdd-execution.md#Protocolo del implementador',
      'section:dual-harness/rules/sdd-execution.md#nope',
      'section:dual-harness/rules/missing.md#x',
    ]);
    expect(result.text).toContain('## Protocolo del implementador\nstep 1');
    expect(result.text).not.toContain('## Otra');
    expect(result.text).toContain('(sin fuente: sección «nope» no resuelta');
    expect(result.text).toContain('(sin fuente: sdd/dual-harness/rules/missing.md no existe)');
  });

  it('every missing source degrades to a «(sin fuente: …)» line', () => {
    const { result } = pack({}, ['cycle', 'spec', 'tasks:@unit', 'plan:@unit', 'refs:@unit', 'context:@app', 'registry:api@app', 'verify:@app', 'acceptance', 'doc:plan', 'bogus']);
    expect(result.text.match(/\(sin fuente:/g)!.length).toBeGreaterThanOrEqual(10);
  });
});

describe('pack.mjs assembly', () => {
  const include = ['cycle', 'tasks:@unit', 'plan:@unit', 'refs:@unit', 'context:@app', 'registry:api@unit', 'verify:@app'];

  it('is deterministic byte for byte except the date line', () => {
    const first = pack(baseFiles(), include).result.text;
    const second = pack(baseFiles(), include).result.text.replace(NOW, '2030-01-01T00:00:00.000Z');
    const strip = (text: string) => text.split('\n').filter((line) => !line.startsWith('> Generado')).join('\n');
    expect(strip(second)).toBe(strip(first));
  });

  it('numbers sections, hashes every source once and sums the full source bytes', () => {
    const files = baseFiles();
    const { result } = pack(files, include);
    expect(result.text).toMatch(/^# Pack · spec-u-001-demo · cycle-01 · B-01 · implementor-back\n> Generado por `pnpm sdd:pack` \(2026-11-17T00:00:00.000Z\)/);
    expect(result.text).toContain('# [1] Ciclo');
    expect(result.text).toContain('# [7] Verificación de apps/api');
    const fuentes = result.text.split('\n').find((line) => line.startsWith('> Fuentes:'))!;
    expect(fuentes.match(/planner\.md@[0-9a-f]{8}/g)).toHaveLength(1);
    const expected = [`${CYCLE_DIR}/cycle.json`, `${CYCLE_DIR}/brief.yaml`, `${CYCLE_DIR}/tasks.json`, `${CYCLE_DIR}/planner.md`, `${CYCLE_DIR}/architect.md`, `${CYCLE_DIR}/functional.md`, 'sdd/context/apps/api/context_prompt.md', 'sdd/context/apps/api/constitution.md', 'sdd/context/apps/api/updates/2026-01-01-a.md', 'sdd/context/apps/api/updates/2026-01-02-b.md', 'sdd/api.json', 'sdd/verify.json'];
    expect(result.sourceBytes).toBe(expected.reduce((sum, path) => sum + Buffer.byteLength(files[path]), 0));
  });

  it('flags a pack over max_pack_bytes in the header and does not truncate it', () => {
    const { result } = pack(baseFiles(), include, { limits: { max_pack_bytes: 100 } });
    expect(result.oversize).toBe(true);
    expect(result.text).toContain('supera max_pack_bytes (100)');
    expect(result.text).toContain('# [7] Verificación');
  });

  it('keeps the source text untouched, CRLF folded to LF', () => {
    const files = baseFiles();
    files[`${CYCLE_DIR}/functional.md`] = '﻿# Func\r\n\r\n### US-1-001: Story\r\n  indented  \r\n';
    const { result } = pack(files, ['doc:functional']);
    expect(result.text).toContain('### US-1-001: Story\n  indented  ');
    expect(result.text).not.toContain('\r');
  });
});

describe('pack.mjs stats and validator helpers', () => {
  it('lists the blocks of the role, or every task without blocks, and one unit for cycle roles', () => {
    const withBlocks = { tasks: tasks.tasks, batches: tasks.batches };
    expect(lib.statsUnits({ tasksJson: withBlocks, roleDef: { unit: 'batch' }, role: 'implementor-back' }).map((u) => u.id)).toEqual(['B-01']);
    expect(lib.statsUnits({ tasksJson: withBlocks, roleDef: { unit: 'batch' }, role: 'implementor-front' })).toEqual([]);
    expect(lib.statsUnits({ tasksJson: { tasks: tasks.tasks }, roleDef: { unit: 'batch' }, role: 'x' }).map((u) => u.id)).toEqual(['TASK-001', 'TASK-002']);
    expect(lib.statsUnits({ tasksJson: withBlocks, roleDef: { unit: 'cycle' }, role: 'reviewer' }).map((u) => u.id)).toEqual(['cycle']);
  });

  it('ranks the pack misses that repeat', () => {
    const list = [{ usage: { pack_misses: ['a.ts', 'b.ts'] } }, { usage: { pack_misses: ['a.ts'] } }, { usage: {} }, {}];
    expect(lib.topPackMisses(list)).toEqual([{ path: 'a.ts', count: 2 }]);
  });

  it('reports each explicit ref that does not resolve', () => {
    expect(lib.unresolvedExplicitRefs(fakeIo(baseFiles()), CYCLE_DIR)).toEqual([{ task: 'TASK-001', ref: 'architect#D-99' }]);
    expect(lib.unresolvedExplicitRefs(fakeIo({}), CYCLE_DIR)).toEqual([]);
  });
});

describe('pack.mjs audit regressions', () => {
  it('derived and explicit refs fall back to the parent heading, stripping trailing -NNN segments', () => {
    expect(lib.parentIds('US-1-020')).toEqual(['US-1']);
    expect(lib.parentIds('US-2-001-003')).toEqual(['US-2-001', 'US-2']);
    expect(lib.parentIds('D-04')).toEqual([]);
    expect([...lib.mentionedIds('user_stories: ["US-1-020"]', new Set(['US-1']))]).toEqual(['US-1']);
    const found = headings('# F\n\n### US-1: Parent\ntext\n\n### US-2-001: Child\n');
    expect(lib.resolveWithParents(found, 'US-1-020').heading?.text).toBe('US-1: Parent');
    expect(lib.resolveWithParents(found, 'US-2-001').heading?.text).toBe('US-2-001: Child');
    expect(lib.resolveWithParents(found, 'US-9-020').heading).toBeUndefined();
  });

  it('the pack resolves a task citing a child id to the parent story, and the validator helper agrees', () => {
    const files = baseFiles();
    files[`${CYCLE_DIR}/functional.md`] = '# Func\n\n### US-1: Parent story\nbody\n';
    files[`${CYCLE_DIR}/tasks.json`] = JSON.stringify({ ...tasks, tasks: [{ ...tasks.tasks[0], user_stories: ['US-1-020'], refs: ['functional#US-1-021'] }, tasks.tasks[1]] });
    const { result } = pack(files, ['refs:@unit']);
    expect(result.text).toContain('### US-1: Parent story');
    expect(result.unresolved).toEqual([]);
    expect(lib.unresolvedExplicitRefs(fakeIo(files), CYCLE_DIR)).toEqual([]);
  });

  it('resolveToken step 3 matches whole words, never substrings', () => {
    expect(lib.resolveToken(headings('## D-041. Otro\nx\n'), 'D-04')).toMatchObject({ reason: 'not found' });
    expect(lib.resolveToken(headings('## `D-04` uno\n## D-040 dos\n'), 'D-04').heading?.text).toBe('`D-04` uno');
    expect(lib.resolveToken(headings('## Gate global\n## Otro gate extra\n'), 'gate')).toMatchObject({ reason: 'ambiguous' });
    expect(lib.headingId('`D-04` a')).toBe('D-04');
    expect(lib.headingId('**D-04** a')).toBe('D-04');
  });

  it('section: refuses paths that leave sdd/ and --app style ids that are not apps|libs|tools/<name>', () => {
    const files = { ...baseFiles(), 'sdd/../package.json': '# pkg\nsecret\n' };
    const { result } = pack(files, ['section:../package.json#pkg', 'section:a/../../package.json#pkg', 'section:/etc/passwd#x']);
    expect(result.text.match(/\(sin fuente: ruta fuera de sdd\//g)).toHaveLength(3);
    expect(result.text).not.toContain('secret');
    expect(lib.isInsideSdd('dual-harness/rules/a.md')).toBe(true);
    for (const bad of ['../x', 'a/../b', '/abs', 'C:/x', 'a\\..\\b']) expect(lib.isInsideSdd(bad)).toBe(false);
    for (const bad of ['../x', 'apps/..', 'apps/../libs/x', 'apps', '/apps/x', 'apps/a/b', 'other/x', '']) expect(lib.isSafeApp(bad)).toBe(false);
    expect(lib.isSafeApp('apps/demo-api')).toBe(true);
    expect(lib.resolveApp({ requested: '../etc' }).error).toContain('apps|libs|tools');
    expect(lib.resolveApp({ unitApp: 'apps/../x', cycleApps: [] }).error).toContain('apps|libs|tools');
    expect(pack(baseFiles(), ['context:@app'], { app: '../x' }).result.text).toContain('(sin fuente: sin subproyecto resuelto)');
  });

  it('ranges: multi-group, one-sided, ellipsis, mixed padding; reversed and over-cap are reported', () => {
    expect(lib.expandRanges('US-2-001..US-2-003')).toEqual(['US-2-001', 'US-2-002', 'US-2-003']);
    expect(lib.expandRanges('US-2-001..003')).toEqual(['US-2-001', 'US-2-002', 'US-2-003']);
    expect(lib.expandRanges('D-1..D-03')).toEqual(['D-01', 'D-02', 'D-03']);
    expect(lib.expandRanges('D-01…D-02')).toEqual(['D-01', 'D-02']);
    expect(lib.rangeProblems('D-03..D-01 y D-1..D-999 y D-1..D-2')).toEqual(['D-03..D-01 (rango invertido)', 'D-1..D-999 (rango de más de 200)']);
    const known = new Set(['RN-9', 'RN-10']);
    expect([...lib.mentionedIds('RN-9..10', known)].sort()).toEqual(['RN-10', 'RN-9']);
    const files = baseFiles();
    files[`${CYCLE_DIR}/planner.md`] = '### TASK-001: One\nVer D-03..D-01.\n\n### TASK-002: Two\n';
    const { result } = pack(files, ['refs:@unit']);
    expect(result.unresolved).toContain('D-03..D-01 (rango invertido)');
  });

  it('registry:api@unit matches whole paths only', () => {
    expect(lib.mentionsPath('see /users/admin', '/users')).toBe(false);
    expect(lib.mentionsPath('see /users/admin', '/users/admin')).toBe(true);
    expect(lib.mentionsPath('GET /users.', '/users')).toBe(true);
    expect(lib.mentionsPath('GET /users/:id', '/users')).toBe(true);
    expect(lib.mentionsPath('GET /users_all x /users', '/users')).toBe(true);
    expect(lib.mentionsPath('/', '/')).toBe(false);
  });

  it('registry:api@unit leaves Fuentes, trailers and unresolved untouched when refs/plan/tasks are not included', () => {
    const files = baseFiles();
    files[`${CYCLE_DIR}/tasks.json`] = JSON.stringify({ ...tasks, tasks: [{ ...tasks.tasks[0], refs: ['architect#D-99'] }, tasks.tasks[1]] });
    const { result } = pack(files, ['cycle', 'registry:api@unit']);
    const fuentes = result.text.split('\n').find((line) => line.startsWith('> Fuentes:'))!;
    expect(fuentes).not.toMatch(/planner|architect|functional|tasks\.json/);
    expect(fuentes).toContain('sdd/api.json');
    expect(result.unresolved).toEqual([]);
    expect(result.text).not.toContain('refs sin resolver)');
    expect(result.text).toContain('"path": "/orders/{id}"');
    const withRefs = pack(files, ['cycle', 'tasks:@unit', 'refs:@unit', 'registry:api@unit']).result;
    expect(withRefs.unresolved).toEqual(['architect#D-99']);
  });

  it('headings inside YAML front matter and HTML comments are ignored; sections are not split by comments', () => {
    expect(headings('---\n# comment\nname: x\n---\n# Real\n').map((h) => h.text)).toEqual(['Real']);
    const found = headings('## D-04\na\n<!--\n## old\n-->\nb\n## Next\n');
    expect(found.map((h) => h.text)).toEqual(['D-04', 'Next']);
    expect(found[0]).toMatchObject({ line: 1, end: 6 });
    expect(headings('## A\n<!-- ## inline -->\n## B\n').map((h) => h.text)).toEqual(['A', 'B']);
    expect([...lib.maskedLines(['---', 'a', '---', 'x'])]).toEqual([0, 1, 2]);
    expect(headings('not front\n---\n# H\n').map((h) => h.text)).toEqual(['H']);
  });

  it('pack misses sort by code unit and tolerate junk; null or invalid task entries are skipped', () => {
    const list = [{ usage: { pack_misses: ['b.ts', 'B.ts'] } }, { usage: { pack_misses: ['b.ts', 'B.ts', 7] } }, null, 'x', { usage: { pack_misses: 'abc' } }];
    expect(lib.topPackMisses(list as object[])).toEqual([{ path: 'B.ts', count: 2 }, { path: 'b.ts', count: 2 }]);
    const messy = { tasks: [null, 5, { id: 7 }, { id: 'TASK-001', title: 't', status: 'pending', files: [] }], batches: [null, 'B', { id: 'B-01', app: 'apps/x', role: 'r', tasks: 'oops' }] };
    expect(lib.resolveUnit(messy, { kind: 'tasks', ids: ['TASK-001'] }).unit?.taskIds).toEqual(['TASK-001']);
    expect(lib.resolveUnit(messy, { kind: 'batch', id: 'B-01' }).unit?.taskIds).toEqual([]);
    expect(lib.statsUnits({ tasksJson: messy, roleDef: { unit: 'batch' }, role: 'r' }).map((u) => u.id)).toEqual(['B-01']);
    const files = baseFiles();
    files[`${CYCLE_DIR}/tasks.json`] = JSON.stringify({ ...tasks, tasks: [null, ...tasks.tasks, 3] });
    expect(() => pack(files, ['tasks:@unit', 'tasks:@all:summary', 'plan:@unit', 'refs:@unit'])).not.toThrow();
    expect(lib.unresolvedExplicitRefs(fakeIo(files), CYCLE_DIR)).toEqual([{ task: 'TASK-001', ref: 'architect#D-99' }]);
  });
});
