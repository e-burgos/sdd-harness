import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { resolve, join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

import { generateSDD } from '../sdd.generator.js';
import { createSpec } from '../spec.generator.js';

const REPO_ROOT = resolve(__dirname, '../../..');

type Task = Record<string, unknown>;

describe.skipIf(process.platform === 'win32')('validate-sdd.mjs optional fields (integration)', () => {
  let ws: string;
  let specId: string;
  let tasksFile: string;

  const task = (id: string, extra: Task = {}): Task => ({
    id, title: `title ${id}`, user_stories: [], estimation_hours: 1, story_points: 3, depends_on: [], status: 'pending', files: [], ...extra,
  });

  const document = (tasks: Task[], extra: Task = {}) => ({
    $schema: '../../../../schemas/cycle-tasks.schema.json',
    spec: specId,
    cycle: 1,
    module: 'orders',
    apps: ['apps/demo-api'],
    flow: 'lite',
    user_stories_generated: false,
    prerequisites: { tasks_generated: true },
    tasks,
    ...extra,
  });

  const write = (doc: unknown, { bom = false } = {}) => {
    writeFileSync(tasksFile, `${bom ? '﻿' : ''}${JSON.stringify(doc, null, 2)}\n`);
  };

  const rebuild = () => execFileSync('node', [resolve(ws, 'sdd/scripts/rebuild-tasks-index.mjs')], { stdio: 'ignore' });

  const validate = () => {
    const run = spawnSync('node', [resolve(ws, 'sdd/scripts/validate-sdd.mjs')], { encoding: 'utf-8' });
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    return { status: run.status, output, warnings: output.split('\n').filter((line) => line.includes('⚠')) };
  };

  const writeVerifyJson = async (entries: Record<string, unknown> = { 'apps/demo-api': { quick: ['true'] } }) => {
    await fs.writeJSON(resolve(ws, 'sdd/verify.json'), { $schema: './schemas/verify.schema.json', ...entries });
  };

  const linkAjv = async () => {
    await fs.ensureDir(resolve(ws, 'node_modules'));
    for (const dep of ['ajv', 'ajv-formats', 'fast-deep-equal', 'fast-uri', 'json-schema-traverse', 'require-from-string']) {
      const src = resolve(REPO_ROOT, 'node_modules', dep);
      if (fs.existsSync(src)) await fs.ensureSymlink(src, resolve(ws, 'node_modules', dep));
    }
  };

  beforeAll(async () => {
    ws = mkdtempSync(resolve(tmpdir(), 'harness-validate-optional-'));
    await generateSDD(ws, {
      projectName: 'validate-proj', description: 'Workspace used to exercise the optional-field warnings.', packageScope: '@validate',
      apps: [{ name: 'demo-api', type: 'nestjs' }], libs: [], services: [], sddProfile: 'solo',
    }, { mergePackageJson: true });
    await linkAjv();
    const created = await createSpec(ws, { slug: 'orders', author: 'eburgos', app: 'apps/demo-api', title: 'Orders' });
    specId = created.specId;
    const cycleDir = resolve(ws, created.folder, 'cycles', 'cycle-01');
    tasksFile = join(cycleDir, 'tasks.json');
    await fs.ensureDir(cycleDir);
    await fs.writeJSON(join(cycleDir, 'cycle.json'), {
      $schema: '../../../../schemas/cycle.schema.json', cycle: 1, module: 'orders', spec: specId, apps: ['apps/demo-api'], flow: 'lite',
      status: 'in-progress', started_at: '2026-09-08', completed_at: null, documents: {}, artifacts: [],
      metrics: { tasks_total: 0, tasks_completed: 0, story_points: 0, files_created: [], files_modified: [], files_deleted: [], usage: { tokens_in: 0, tokens_out: 0, by_agent: [] } },
      tables_created: [], endpoints_implemented: [], components_created: [], issues_found: [], reviewer_report: null,
    });
    await fs.writeFile(join(cycleDir, 'plan.md'), '# plan\n');
  });

  afterAll(() => rmSync(ws, { recursive: true, force: true }));

  beforeEach(async () => {
    write(document([task('TASK-001'), task('TASK-002')]));
    rebuild();
    await writeVerifyJson();
    rmSync(resolve(ws, 'sdd/packs.json'), { force: true });
  });

  it('a repo using none of the new fields gets no batch, allocation or verify warning', () => {
    const run = validate();
    expect(run.status).toBe(0);
    expect(run.output).not.toMatch(/batch|allocation|verify\.json/);
  });

  it('warns once about verify.json when it is missing and when a subproject has no entry', async () => {
    rmSync(resolve(ws, 'sdd/verify.json'));
    const missing = validate();
    expect(missing.status).toBe(0);
    expect(missing.warnings.filter((w) => w.includes('verify.json'))).toEqual([
      expect.stringContaining('missing — run pnpm sdd:verify --init'),
    ]);
    await writeVerifyJson({});
    const unconfigured = validate();
    expect(unconfigured.warnings.filter((w) => w.includes('verify.json'))).toEqual([
      expect.stringContaining('no entry for apps/demo-api — run pnpm sdd:verify --init'),
    ]);
  });

  it('a verify.json that violates its schema is an error', async () => {
    await writeVerifyJson({ 'apps/demo-api': { quick: 'pnpm test' } });
    const run = validate();
    expect(run.status).toBe(1);
    expect(run.output).toContain('verify.json');
    await writeVerifyJson({ 'not-an-app': {} });
    expect(validate().status).toBe(1);
  });

  it('warns per inconsistent block, naming the block and what to fix', () => {
    write(
      document(
        [task('TASK-001'), task('TASK-002'), task('TASK-003'), task('TASK-004'), task('TASK-005')],
        {
          batches: [
            { id: 'B-01', app: 'apps/demo-api', role: 'implementor-back', tasks: ['TASK-001', 'TASK-009'] },
            { id: 'B-02', app: 'apps/other', role: 'implementor-back', tasks: ['TASK-001'], depends_on: ['B-07'] },
            { id: 'B-03', app: 'apps/demo-api', role: 'implementor-back', tasks: ['TASK-002', 'TASK-003', 'TASK-004', 'TASK-005'] },
          ],
        },
      ),
    );
    rebuild();
    const run = validate();
    expect(run.status).toBe(0);
    const text = run.warnings.join('\n');
    expect(text).toContain('B-01: lists unknown task TASK-009');
    expect(text).toContain('B-02: TASK-001 is already in B-01');
    expect(text).toContain('B-02: app apps/other is not in the cycle');
    expect(text).toContain('B-02: depends_on unknown block B-07');
    expect(text).not.toContain('B-03');
  });

  it('reads the block caps from packs.json and tolerates garbage in it', () => {
    const tasks = [task('TASK-001'), task('TASK-002'), task('TASK-003'), task('TASK-004'), task('TASK-005')];
    const batches = [{ id: 'B-01', app: 'apps/demo-api', role: 'r', tasks: tasks.map((t) => t['id'] as string) }];
    write(document(tasks, { batches }));
    rebuild();
    expect(validate().output).toContain('exceeds the cap of 4 tasks / 12 SP');
    writeFileSync(resolve(ws, 'sdd/packs.json'), JSON.stringify({ execution: { max_tasks_per_batch: 6, max_points_per_batch: 20 } }));
    expect(validate().output).not.toContain('exceeds the cap');
    writeFileSync(resolve(ws, 'sdd/packs.json'), '{ not json');
    expect(validate().output).toContain('exceeds the cap of 4 tasks / 12 SP');
  });

  it('a block within the caps and consistent produces no warning', () => {
    write(document([task('TASK-001'), task('TASK-002')], { batches: [{ id: 'B-01', app: 'apps/demo-api', role: 'r', tasks: ['TASK-001', 'TASK-002'] }] }));
    rebuild();
    const run = validate();
    expect(run.status).toBe(0);
    expect(run.output).not.toMatch(/B-01/);
  });

  it('warns when usage.allocation lacks approx: true and stays quiet when it has it', () => {
    const usage = (approx: boolean) => ({
      tokens_in: 10, tokens_out: 2, provider_model: 'claude/sonnet', effort: 'medium', agent: 'implementor-back', approx,
      source: approx ? 'declared-estimate' : 'agent-usage-notification', allocation: { batch: 'B-01', batch_tokens: 500 }, pack_misses: ['a.ts'],
    });
    write(document([task('TASK-001', { status: 'done', usage: usage(false) }), task('TASK-002')]));
    rebuild();
    const without = validate();
    expect(without.status).toBe(0);
    expect(without.warnings.join('\n')).toContain('TASK-001: usage.allocation without approx: true');
    write(document([task('TASK-001', { status: 'done', usage: usage(true) }), task('TASK-002')]));
    rebuild();
    expect(validate().output).not.toContain('usage.allocation');
  });

  it('enforces the shape of the new schema fields', () => {
    write(document([task('TASK-001', { refs: ['architect#D-04'] })], { batches: [{ id: 'B-01', app: 'apps/demo-api', role: 'r', tasks: ['TASK-001'] }] }));
    rebuild();
    expect(validate().status).toBe(0);
    write(document([task('TASK-001', { refs: ['not a ref'] })]));
    rebuild();
    expect(validate().status).toBe(1);
    write(document([task('TASK-001')], { batches: [{ id: 'B-1', app: 'apps/demo-api', role: 'r', tasks: ['TASK-001'] }] }));
    rebuild();
    expect(validate().status).toBe(1);
    const usage = { tokens_in: 1, tokens_out: 1, pack_misses: ['1', '2', '3', '4', '5', '6'] };
    write(document([task('TASK-001', { status: 'done', usage })]));
    rebuild();
    expect(validate().status).toBe(1);
  });

  it('measures the core before the absorbed heading and never fires at or under 6,000 bytes', async () => {
    const heading = '## Instrucciones previas del proyecto (absorbidas al instalar SDD)\n';
    const file = resolve(ws, 'sdd/dual-harness/CLAUDE.md');
    const warningsOfCore = () => validate().warnings.filter((w) => w.includes('core over 6,000 bytes'));
    await fs.writeFile(file, 'x'.repeat(6000));
    expect(warningsOfCore()).toEqual([]);
    await fs.writeFile(file, `${'x'.repeat(5990)}\n${heading}${'y'.repeat(20000)}`);
    expect(warningsOfCore()).toEqual([]);
    await fs.writeFile(file, `${'x'.repeat(6001)}\n${heading}`);
    expect(warningsOfCore()).toEqual([expect.stringContaining('CLAUDE.md (6,005 bytes) — run harness update sdd --split-project')]);
  });

  it('prints one core-size line listing every harness file over the cap', async () => {
    for (const name of ['CLAUDE.md', 'AGENTS.md']) await fs.writeFile(resolve(ws, 'sdd/dual-harness', name), 'x'.repeat(6500));
    const lines = validate().warnings.filter((w) => w.includes('core over'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('CLAUDE.md (6,500 bytes), AGENTS.md (6,500 bytes)');
  });

  it('reports schema-invalid batches as a schema error without crashing the block section', () => {
    const shapes: unknown[] = [{}, [{ id: 'B-01', app: 'apps/demo-api', role: 'x' }], [{ id: 'B-01', app: 'apps/demo-api', role: 'x', tasks: 'TASK-001' }], [null], [{ id: 'B-01', app: 'apps/demo-api', role: 'x', tasks: ['TASK-001'], depends_on: 'B-02' }]];
    for (const batches of shapes) {
      write(document([task('TASK-001')], { batches }));
      rebuild();
      const run = validate();
      expect(run.status, JSON.stringify(batches)).toBe(1);
      expect(run.output, JSON.stringify(batches)).not.toMatch(/TypeError|at .*validate-sdd\.mjs/);
      expect(run.output).toMatch(/batches/);
    }
  });

  it('parses records that start with a BOM in the validator and in the index rebuild', () => {
    write(document([task('TASK-001')]), { bom: true });
    expect(() => execFileSync('node', [resolve(ws, 'sdd/scripts/rebuild-tasks-index.mjs')], { stdio: 'pipe' })).not.toThrow();
    const run = validate();
    expect(run.status).toBe(0);
    expect(run.output).not.toMatch(/invalid JSON/);
  });
});
