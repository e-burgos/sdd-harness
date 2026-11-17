import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { resolve, join } from 'node:path';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

import { generateSDD } from '../sdd.generator.js';
import { createSpec } from '../spec.generator.js';

const REPO_ROOT = resolve(__dirname, '../../..');
const identity = ['--model', 'claude/sonnet', '--effort', 'medium', '--agent', 'implementor-back'];

describe.skipIf(process.platform === 'win32')('sdd-task.mjs (integration)', () => {
  let parent: string;
  let ws: string;
  let cycleDir: string;
  let specId: string;
  let tasksFile: string;

  const git = (...args: string[]) => execFileSync('git', ['-C', ws, ...args], { encoding: 'utf-8' });
  const readText = () => readFileSync(tasksFile, 'utf-8');
  const readDoc = () => JSON.parse(readText());
  const task = (id: string) => readDoc().tasks.find((t: { id: string }) => t.id === id);

  const runTask = (args: string[], cwd = ws) => {
    const run = spawnSync('node', [resolve(ws, 'sdd/scripts/sdd-task.mjs'), ...args], { encoding: 'utf-8', cwd });
    return { status: run.status, stdout: run.stdout ?? '', stderr: run.stderr ?? '', output: `${run.stdout ?? ''}${run.stderr ?? ''}` };
  };

  const fixture = () => ({
    $schema: '../../../../schemas/cycle-tasks.schema.json',
    spec: specId,
    cycle: 1,
    module: 'orders',
    apps: ['apps/demo-api'],
    flow: 'lite',
    user_stories_generated: false,
    prerequisites: { tasks_generated: true },
    tasks: ['TASK-001', 'TASK-002', 'TASK-003'].map((id) => ({
      id, title: `title ${id}`, user_stories: [], estimation_hours: 1, story_points: 1, depends_on: [], status: 'pending', files: [],
    })),
  });

  const reset = (text = `${JSON.stringify(fixture(), null, 2)}\n`) => {
    writeFileSync(tasksFile, text);
    execFileSync('node', [resolve(ws, 'sdd/scripts/rebuild-tasks-index.mjs')], { stdio: 'ignore' });
  };

  const linkAjv = async () => {
    await fs.ensureDir(resolve(ws, 'node_modules'));
    for (const dep of ['ajv', 'ajv-formats', 'fast-deep-equal', 'fast-uri', 'json-schema-traverse', 'require-from-string']) {
      const src = resolve(REPO_ROOT, 'node_modules', dep);
      if (fs.existsSync(src)) await fs.ensureSymlink(src, resolve(ws, 'node_modules', dep));
    }
  };

  beforeAll(async () => {
    parent = mkdtempSync(resolve(tmpdir(), 'harness task '));
    ws = join(parent, 'work space');
    await fs.ensureDir(ws);
    await generateSDD(ws, {
      projectName: 'task-proj', description: 'Workspace used to exercise sdd:task.', packageScope: '@task',
      apps: [{ name: 'demo-api', type: 'nestjs' }], libs: [], services: [], sddProfile: 'solo',
    }, { mergePackageJson: true });
    await linkAjv();
    const created = await createSpec(ws, { slug: 'orders', author: 'eburgos', app: 'apps/demo-api', title: 'Orders' });
    specId = created.specId;
    cycleDir = resolve(ws, created.folder, 'cycles', 'cycle-01');
    tasksFile = join(cycleDir, 'tasks.json');
    await fs.ensureDir(cycleDir);
    await fs.writeJSON(join(cycleDir, 'cycle.json'), {
      $schema: '../../../../schemas/cycle.schema.json', cycle: 1, module: 'orders', spec: specId, apps: ['apps/demo-api'], flow: 'lite',
      status: 'in-progress', started_at: '2026-09-08', completed_at: null, documents: {}, artifacts: [],
      metrics: { tasks_total: 0, tasks_completed: 0, story_points: 0, files_created: [], files_modified: [], files_deleted: [], usage: { tokens_in: 0, tokens_out: 0, by_agent: [] } },
      tables_created: [], endpoints_implemented: [], components_created: [], issues_found: [], reviewer_report: null,
    });
    await fs.writeFile(join(cycleDir, 'plan.md'), '# plan\n');
    const global = await fs.readJSON(resolve(ws, 'sdd/global.json'));
    const entry = global.pending_modules.find((m: { spec: string }) => m.spec === specId);
    global.pending_modules = global.pending_modules.filter((m: { spec: string }) => m.spec !== specId);
    global.in_progress_modules.push(entry);
    await fs.writeJSON(resolve(ws, 'sdd/global.json'), global, { spaces: 2 });
    reset();
    git('init', '-q');
    git('config', 'user.email', 't@t.t');
    git('config', 'user.name', 't');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
  });

  afterAll(() => rmSync(parent, { recursive: true, force: true }));
  beforeEach(() => reset());

  it('ships the sdd:task script', async () => {
    expect((await fs.readJSON(resolve(ws, 'package.json'))).scripts['sdd:task']).toBe('node sdd/scripts/sdd-task.mjs');
  });

  it('start marks in-progress, prints one line and leaves other tasks byte-identical', () => {
    const before = readDoc();
    const run = runTask([specId, 'cycle-01', 'TASK-002', 'start']);
    expect(run.status).toBe(0);
    expect(run.stdout.trim().split('\n')).toHaveLength(1);
    expect(run.stdout).toContain('TASK-002 start');
    expect(run.stdout).toContain('validate OK');
    const after = readDoc();
    expect(after.tasks[1].status).toBe('in-progress');
    expect(JSON.stringify(after.tasks[0])).toBe(JSON.stringify(before.tasks[0]));
    expect(JSON.stringify(after.tasks[2])).toBe(JSON.stringify(before.tasks[2]));
    expect(readText()).toBe(`${JSON.stringify(after, null, 2)}\n`);
  });

  it('done with --files and --tokens writes usage after files and regenerates the index', async () => {
    const run = runTask(['orders', '1', 'TASK-001', 'done', '--files', 'b.ts,a.ts', '--tokens', '41200', ...identity, '--duration', '7']);
    expect(run.status).toBe(0);
    expect(run.stdout.trim()).toBe('TASK-001 done · 2 files · 41,200 tokens · validate OK');
    const done = task('TASK-001');
    expect(done.status).toBe('done');
    expect(done.files).toEqual(['b.ts', 'a.ts']);
    expect(Object.keys(done).slice(-2)).toEqual(['files', 'usage']);
    expect(done.usage).toMatchObject({
      provider_model: 'claude/sonnet', effort: 'medium', agent: 'implementor-back',
      tokens_in: 35020, tokens_out: 6180, tokens_total: 41200, duration_minutes: 7, approx: false, source: 'agent-usage-notification',
    });
    expect(done.usage.recorded_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const index = JSON.stringify(await fs.readJSON(resolve(ws, 'sdd/tasks.json')));
    expect(index).toContain('"tasks_done":1');
  });

  it('explicit in/out and --approx default the source to declared-estimate', () => {
    const run = runTask([specId, 'cycle-01', 'TASK-001', 'done', '--files', 'a.ts', '--tokens-in', '100', '--tokens-out', '20', ...identity, '--approx']);
    expect(run.status).toBe(0);
    const usage = task('TASK-001').usage;
    expect(usage).toMatchObject({ tokens_in: 100, tokens_out: 20, approx: true, source: 'declared-estimate' });
    expect(usage.tokens_total).toBeUndefined();
  });

  it('done with --commit takes the commit files minus sdd/, unioned with --files without duplicates', () => {
    mkdirSync(join(ws, 'src'), { recursive: true });
    writeFileSync(join(ws, 'src/b.ts'), 'b');
    writeFileSync(join(ws, 'src/a.ts'), 'a');
    writeFileSync(join(ws, 'sdd/notes.md'), 'n');
    git('add', '-A');
    git('commit', '-q', '-m', 'work');
    const sha = git('rev-parse', 'HEAD').trim();
    const run = runTask([specId, 'cycle-01', 'TASK-003', 'done', '--files', 'src/z.ts,src/a.ts', '--commit', sha, '--tokens', '10', ...identity]);
    expect(run.status).toBe(0);
    expect(task('TASK-003').files).toEqual(['src/z.ts', 'src/a.ts', 'src/b.ts']);
  });

  it('rejects bad input with exit 2 and leaves the file untouched', () => {
    const before = readText();
    const ok = [specId, 'cycle-01', 'TASK-001', 'done', '--files', 'a', '--tokens', '10'];
    const cases: string[][] = [
      [...ok, ...identity, '--source', 'declared-estimate'],
      [...ok, ...identity, '--batch', 'B-01', '--batch-tokens', '5'],
      [specId, 'cycle-01', 'TASK-099', 'start'],
      [specId, 'cycle-09', 'TASK-001', 'start'],
      ['ghost', 'cycle-01', 'TASK-001', 'start'],
      [...ok, '--model', 'gpt', '--effort', 'medium', '--agent', 'implementor-back'],
      [...ok, '--model', 'claude/sonnet', '--effort', 'Max Power', '--agent', 'implementor-back'],
      [...ok, '--model', 'claude/sonnet', '--effort', 'medium', '--agent', 'wizard'],
      [...ok, ...identity, ...Array.from({ length: 6 }, (_, i) => ['--pack-miss', `p${i}`]).flat()],
      [...ok, ...identity, '--commit', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'],
    ];
    for (const args of cases) {
      const run = runTask(args);
      expect(run.status, args.join(' ')).toBe(2);
      expect(run.stderr.trim().split('\n').length).toBeGreaterThan(0);
      expect(readText()).toBe(before);
    }
  });

  it('done on a done task needs --force, which replaces files and usage', () => {
    const args = (file: string) => [specId, 'cycle-01', 'TASK-001', 'done', '--files', file, '--tokens', '10', ...identity];
    expect(runTask(args('a.ts')).status).toBe(0);
    const before = readText();
    expect(runTask(args('b.ts')).status).toBe(2);
    expect(readText()).toBe(before);
    expect(runTask([...args('b.ts'), '--force']).status).toBe(0);
    expect(task('TASK-001').files).toEqual(['b.ts']);
  });

  it('writes allocation and pack_misses as the contract says', () => {
    runTask([specId, 'cycle-01', 'TASK-001', 'done', '--files', 'a', '--tokens', '10', ...identity, '--approx', '--batch', 'B-02', '--batch-tokens', '500', '--pack-miss', 'x.ts', '--pack-miss', 'y.ts']);
    const usage = task('TASK-001').usage;
    expect(usage.allocation).toEqual({ batch: 'B-02', batch_tokens: 500 });
    expect(usage.pack_misses).toEqual(['x.ts', 'y.ts']);
  });

  it('works from a subdirectory of the repo', () => {
    mkdirSync(join(ws, 'apps/demo-api'), { recursive: true });
    const run = runTask([specId, 'cycle-01', 'TASK-001', 'start'], join(ws, 'apps/demo-api'));
    expect(run.status).toBe(0);
    expect(task('TASK-001').status).toBe('in-progress');
  });

  it('handles CRLF and BOM, writing back LF without BOM', () => {
    const crlf = `﻿${JSON.stringify(fixture(), null, 2).replace(/\n/g, '\r\n')}\r\n`;
    writeFileSync(tasksFile, crlf);
    const run = runTask([specId, 'cycle-01', 'TASK-001', 'start']);
    expect(run.status).toBe(0);
    const text = readText();
    expect(text.startsWith('{')).toBe(true);
    expect(text).not.toContain('\r');
    expect(text.endsWith('}\n')).toBe(true);
  });

  it('exits 1 with the validator message when validation is red after the write', () => {
    const broken = fixture();
    (broken.tasks[1] as { story_points: number }).story_points = 4;
    reset(`${JSON.stringify(broken, null, 2)}\n`);
    const run = runTask([specId, 'cycle-01', 'TASK-001', 'start']);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('validate-sdd');
    expect(run.stdout).toBe('');
  });
});
