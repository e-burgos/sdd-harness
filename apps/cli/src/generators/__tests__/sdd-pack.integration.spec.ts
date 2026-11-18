import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, join } from 'node:path';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

import { generateSDD } from '../sdd.generator.js';
import { createSpec } from '../spec.generator.js';

describe.skipIf(process.platform === 'win32')('sdd-pack.mjs (integration)', () => {
  let parent: string;
  let ws: string;
  let cycleDir: string;
  let specId: string;
  let tasks: Record<string, unknown>;

  const run = (args: string[]) => {
    const result = spawnSync('node', [resolve(ws, 'sdd/scripts/sdd-pack.mjs'), ...args], { encoding: 'utf-8', cwd: ws });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  };

  const packPath = (name: string) => join(cycleDir, 'artifacts/packs', name);
  const task = (id: string, extra: Record<string, unknown> = {}) => ({
    id, title: `title ${id}`, user_stories: [], estimation_hours: 1, story_points: 3, depends_on: [], status: 'pending', files: [], ...extra,
  });

  beforeAll(async () => {
    parent = mkdtempSync(resolve(tmpdir(), 'harness pack '));
    ws = join(parent, 'work space');
    await fs.ensureDir(ws);
    await generateSDD(ws, {
      projectName: 'pack-proj',
      description: 'Workspace used to exercise sdd:pack.',
      packageScope: '@pack',
      apps: [{ name: 'demo-api', type: 'nestjs' }],
      libs: [],
      services: [],
      sddProfile: 'solo',
    }, { mergePackageJson: true });
    const created = await createSpec(ws, { slug: 'orders', author: 'eburgos', app: 'apps/demo-api', title: 'Orders' });
    specId = created.specId;
    cycleDir = resolve(ws, created.folder, 'cycles', 'cycle-01');
    await fs.ensureDir(cycleDir);
    await fs.writeJSON(join(cycleDir, 'cycle.json'), {
      cycle: 1, module: 'orders', spec: specId, apps: ['apps/demo-api'], flow: 'full', status: 'in-progress', started_at: '2026-09-08', objectives: ['Ship orders'],
    });
    tasks = {
      spec: specId,
      cycle: 1,
      apps: ['apps/demo-api'],
      tasks: [task('TASK-001', { story_points: 5 }), task('TASK-002', { depends_on: ['TASK-001'] })],
      batches: [{ id: 'B-01', app: 'apps/demo-api', role: 'implementor-back', tasks: ['TASK-001', 'TASK-002'] }],
    };
    await fs.writeJSON(join(cycleDir, 'tasks.json'), tasks);
    await fs.writeFile(join(cycleDir, 'planner.md'), '## Plan\n\n### TASK-001: First\nSee D-01 and GET /orders.\n\n### TASK-002: Second\nnothing\n');
    await fs.writeFile(join(cycleDir, 'architect.md'), '# Arch\n\n### D-01. Decision\nuse it\n');
    await fs.writeFile(join(cycleDir, 'functional.md'), '# Func\n\n### US-1-001: Story\n\n- [ ] CA-001: works\n');
  });

  afterAll(() => rmSync(parent, { recursive: true, force: true }));

  it('kit ships packs.json, its schema and the sdd:pack script', async () => {
    const pkg = await fs.readJSON(resolve(ws, 'package.json'));
    expect(pkg.scripts['sdd:pack']).toBe('node sdd/scripts/sdd-pack.mjs');
    expect(existsSync(resolve(ws, 'sdd/schemas/packs.schema.json'))).toBe(true);
    const packs = await fs.readJSON(resolve(ws, 'sdd/packs.json'));
    expect(Object.keys(packs.roles)).toEqual(['implementor-back', 'implementor-front', 'reviewer', 'functional', 'planner', 'architect']);
    expect(packs.execution).toEqual({ max_tasks_per_batch: 4, max_points_per_batch: 12, max_parallel_batches: 1 });
  });

  it('writes a batch pack, self-ignores the directory and prints one summary line', () => {
    const result = run([specId, 'cycle-01', 'implementor-back', 'B-01']);
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split('\n')).toHaveLength(1);
    expect(result.stdout).toMatch(/artifacts\/packs\/B-01\.implementor-back\.md · \d+ bytes \(~\d+\.\dk tokens\) · sources \d+ bytes/);
    const text = readFileSync(packPath('B-01.implementor-back.md'), 'utf-8');
    expect(text).toContain(`# Pack · ${specId} · cycle-01 · B-01 · implementor-back`);
    expect(text).toContain('### TASK-001: First');
    expect(text).toContain('### D-01. Decision');
    expect(text).toContain('## Protocolo del implementador');
    expect(text).not.toContain('"usage"');
    expect(readFileSync(packPath('.gitignore'), 'utf-8')).toBe('*\n');
  });

  it('accepts a task list as the unit and a slug as the spec', () => {
    const result = run(['orders', '1', 'implementor-back', 'TASK-002,TASK-001']);
    expect(result.status).toBe(0);
    expect(existsSync(packPath('TASK-001+TASK-002.implementor-back.md'))).toBe(true);
  });

  it('builds a cycle-role pack without a unit', () => {
    const result = run([specId, 'cycle-01', 'reviewer']);
    expect(result.status).toBe(0);
    const text = readFileSync(packPath('cycle.reviewer.md'), 'utf-8');
    expect(text).toContain('- TASK-001 · pending · 5 SP · title TASK-001 · 0 files');
    expect(text).toContain('- [ ] CA-001: works');
    expect(text).toContain('CONTEXTO GATE');
  });

  it('--stdout prints the pack and writes nothing', () => {
    rmSync(packPath('B-01.implementor-back.md'));
    const result = run([specId, 'cycle-01', 'implementor-back', 'B-01', '--stdout']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('# [1] Ciclo');
    expect(result.stderr).toContain('bytes');
    expect(existsSync(packPath('B-01.implementor-back.md'))).toBe(false);
  });

  it('--stats lists every possible pack with a total and writes nothing', () => {
    const result = run([specId, 'cycle-01', '--stats']);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^implementor-back B-01 · pack \d+ bytes/m);
    expect(result.stdout).toMatch(/^reviewer cycle · pack \d+ bytes/m);
    expect(result.stdout).toMatch(/^total · pack \d+ bytes · sources \d+ bytes · 5 packs$/m);
    const json = JSON.parse(run([specId, 'cycle-01', '--stats', '--json']).stdout);
    expect(json.rows).toHaveLength(5);
    expect(json.total.pack_bytes).toBeGreaterThan(0);
  });

  it('--stats ranks repeated pack misses', async () => {
    const usage = (miss: string[]) => ({ tokens_in: 1, tokens_out: 1, provider_model: 'claude/sonnet', effort: 'low', agent: 'implementor-back', approx: true, source: 'declared-estimate', pack_misses: miss });
    const withMisses = { ...tasks, tasks: [task('TASK-001', { status: 'done', usage: usage(['a.ts']) }), task('TASK-002', { status: 'done', usage: usage(['a.ts', 'b.ts']) })] };
    await fs.writeJSON(join(cycleDir, 'tasks.json'), withMisses);
    expect(run([specId, 'cycle-01', '--stats']).stdout).toContain('pack-misses: a.ts ×2');
    await fs.writeJSON(join(cycleDir, 'tasks.json'), tasks);
  });

  it('exits 2 on bad usage and unknown spec, cycle or unit', () => {
    expect(run([specId, 'cycle-01', 'implementor-back']).status).toBe(2);
    expect(run([specId, 'cycle-01', 'implementor-back', 'B-09']).status).toBe(2);
    expect(run([specId, 'cycle-01', 'implementor-back', 'TASK-099']).status).toBe(2);
    expect(run([specId, 'cycle-01', 'implementor-back', 'nonsense']).status).toBe(2);
    expect(run([specId, 'cycle-01', 'reviewer', 'B-01']).status).toBe(2);
    expect(run(['no-such-spec', 'cycle-01', 'reviewer']).status).toBe(2);
    expect(run([specId, 'cycle-07', 'reviewer']).status).toBe(2);
    expect(run([specId, 'cycle-01', 'reviewer', '--bogus']).status).toBe(2);
    expect(run([specId, 'cycle-01', 'reviewer', '--app']).status).toBe(2);
    expect(run([specId, 'cycle-01']).status).toBe(2);
  });

  it('exits 3 when the role has no entry or packs.json is missing, and the agent works as before', async () => {
    const unknown = run([specId, 'cycle-01', 'janitor']);
    expect(unknown.status).toBe(3);
    expect(unknown.stderr).toContain('janitor');
    const original = readFileSync(resolve(ws, 'sdd/packs.json'), 'utf-8');
    rmSync(resolve(ws, 'sdd/packs.json'));
    expect(run([specId, 'cycle-01', 'reviewer']).status).toBe(3);
    writeFileSync(resolve(ws, 'sdd/packs.json'), original);
  });

  it('with several apps and no way to decide it exits 2 listing the candidates; --app decides', async () => {
    const multi = { ...tasks, batches: undefined };
    await fs.writeJSON(join(cycleDir, 'tasks.json'), multi);
    await fs.writeJSON(join(cycleDir, 'cycle.json'), {
      cycle: 1, module: 'orders', spec: specId, apps: ['apps/demo-api', 'apps/demo-web'], flow: 'full', status: 'in-progress', started_at: '2026-09-08',
    });
    const ambiguous = run([specId, 'cycle-01', 'implementor-back', 'TASK-001']);
    expect(ambiguous.status).toBe(2);
    expect(ambiguous.stderr).toContain('apps/demo-api, apps/demo-web');
    expect(run([specId, 'cycle-01', 'implementor-back', 'TASK-001', '--app', 'apps/demo-web']).status).toBe(0);
    expect(run([specId, 'cycle-01', 'implementor-back', 'TASK-001', '--app', 'apps/elsewhere']).status).toBe(2);
    await fs.writeJSON(join(cycleDir, 'tasks.json'), tasks);
  });
});
