import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

import { generateSDD } from '../sdd.generator.js';
import { createSpec } from '../spec.generator.js';

// El SPEC GATE dejó de ser una checklist en prosa (v0.13.0): lo responde
// sdd/scripts/spec-gate.mjs, con forma según el flow del ciclo. Se prueba de verdad
// sobre un kit instalado, igual que validate-sdd.
const REPO_ROOT = resolve(__dirname, '../../..');

type GateJson = { passed: boolean; gate: 'A' | 'B'; next?: { cycle: string; flow: string; profile: string } };
type GateRun = { status: number | null; output: string; json?: GateJson };

describe.skipIf(process.platform === 'win32')('spec-gate.mjs (integration)', () => {
  let ws: string;
  let specId: string;
  let cycleDir: string;

  const runGate = (...args: string[]): GateRun => {
    const run = spawnSync('node', [resolve(ws, 'sdd/scripts/spec-gate.mjs'), ...args], {
      encoding: 'utf-8',
    });
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    const json = args.includes('--json') ? JSON.parse(run.stdout) : undefined;
    return { status: run.status, output, json };
  };

  const runValidate = () => {
    const run = spawnSync('node', [resolve(ws, 'sdd/scripts/validate-sdd.mjs')], {
      encoding: 'utf-8',
    });
    return { ok: run.status === 0, output: `${run.stdout ?? ''}${run.stderr ?? ''}` };
  };

  const linkAjv = async () => {
    await fs.ensureDir(resolve(ws, 'node_modules'));
    for (const dep of [
      'ajv',
      'ajv-formats',
      'fast-deep-equal',
      'fast-uri',
      'json-schema-traverse',
      'require-from-string',
    ]) {
      const src = resolve(REPO_ROOT, 'node_modules', dep);
      if (fs.existsSync(src)) await fs.ensureSymlink(src, resolve(ws, 'node_modules', dep));
    }
  };

  beforeAll(async () => {
    ws = mkdtempSync(resolve(tmpdir(), 'harness-gate-'));
    await generateSDD(ws, {
      projectName: 'gate-proj',
      description: 'Workspace used to exercise the SPEC GATE script.',
      packageScope: '@gate',
      apps: [{ name: 'demo-api', type: 'nestjs' }],
      libs: [],
      services: [],
      sddProfile: 'solo',
    }, { mergePackageJson: true });
    await linkAjv();
    const created = await createSpec(ws, {
      slug: 'orders',
      author: 'eburgos',
      app: 'apps/demo-api',
      title: 'Orders',
    });
    specId = created.specId;
    cycleDir = resolve(ws, created.folder, 'cycles', 'cycle-01');
  });

  afterAll(() => {
    rmSync(ws, { recursive: true, force: true });
  });

  it('el perfil llega a global.json y el kit instala el script sdd:gate', async () => {
    const global = await fs.readJSON(resolve(ws, 'sdd/global.json'));
    expect(global.profile).toBe('solo');
    const pkg = await fs.readJSON(resolve(ws, 'package.json'));
    expect(pkg.scripts['sdd:gate']).toBe('node sdd/scripts/spec-gate.mjs');
    expect(runValidate().ok).toBe(true);
  });

  it('sin argumentos imprime el uso y sale con 2', () => {
    const run = runGate();
    expect(run.status).toBe(2);
    expect(run.output).toContain('GATE A');
  });

  it('GATE A aprueba una spec draft recién registrada y sugiere lite con profile solo', () => {
    const run = runGate('orders');
    expect(run.status).toBe(0);
    expect(run.output).toContain('APROBADO');
    expect(run.output).toContain('cycle-01');
    expect(run.output).toContain('flow sugerido: lite');

    const asJson = runGate(specId, '--json');
    expect(asJson.json?.passed).toBe(true);
    expect(asJson.json?.gate).toBe('A');
    expect(asJson.json?.next).toEqual({ cycle: 'cycle-01', flow: 'lite', profile: 'solo' });
  });

  it('GATE A bloquea cuando una dependencia no está completed', async () => {
    const dependent = await createSpec(ws, {
      slug: 'invoices',
      author: 'eburgos',
      app: 'apps/demo-api',
      dependsOn: [specId],
    });
    const run = runGate(dependent.specId);
    expect(run.status).toBe(1);
    expect(run.output).toContain('BLOQUEADO');
    expect(run.output).toContain('A4');
    expect(run.output).toContain(specId);
  });

  it('una referencia ambigua o desconocida es un error de uso (exit 2)', () => {
    expect(runGate('eburgos').status).toBe(2);
    expect(runGate('nope').status).toBe(2);
  });

  it('GATE B lee el flow lite y exige plan.md, tasks.json y el módulo in-progress', async () => {
    await fs.ensureDir(cycleDir);
    await fs.writeJSON(resolve(cycleDir, 'cycle.json'), {
      $schema: '../../../../schemas/cycle.schema.json',
      cycle: 1,
      module: 'orders',
      spec: specId,
      apps: ['apps/demo-api'],
      flow: 'lite',
      status: 'in-progress',
      started_at: '2026-09-08',
      completed_at: null,
      documents: {},
      artifacts: [],
      metrics: {
        tasks_total: 0,
        tasks_completed: 0,
        story_points: 0,
        files_created: [],
        files_modified: [],
        files_deleted: [],
        usage: { tokens_in: 0, tokens_out: 0, by_agent: [] },
      },
      tables_created: [],
      endpoints_implemented: [],
      components_created: [],
      issues_found: [],
      reviewer_report: null,
    });

    const blocked = runGate('orders', '1');
    expect(blocked.status).toBe(1);
    expect(blocked.output).toContain('flow: lite');
    expect(blocked.output).toContain('faltan: plan.md');
    expect(blocked.output).toContain('B3');

    // El validador avisa (no falla) mientras el ciclo lite no tiene plan.md ni tasks.json.
    const validate = runValidate();
    expect(validate.output).toContain('flow: lite without plan.md');
    expect(validate.output).toContain('in-progress without tasks.json');

    await fs.writeFile(resolve(cycleDir, 'plan.md'), '# plan\n');
    await fs.writeJSON(resolve(cycleDir, 'tasks.json'), {
      $schema: '../../../../schemas/cycle-tasks.schema.json',
      spec: specId,
      cycle: 1,
      module: 'orders',
      apps: ['apps/demo-api'],
      flow: 'lite',
      user_stories_generated: false,
      prerequisites: { tasks_generated: true },
      tasks: [
        {
          id: 'TASK-001',
          title: 'entity',
          user_stories: [],
          estimation_hours: 1,
          story_points: 1,
          depends_on: [],
          status: 'pending',
          files: [],
        },
      ],
    });
    execFileSync('node', [resolve(ws, 'sdd/scripts/rebuild-tasks-index.mjs')], {
      stdio: 'ignore',
    });

    const global = await fs.readJSON(resolve(ws, 'sdd/global.json'));
    const entry = global.pending_modules.find((m: any) => m.spec === specId);
    global.pending_modules = global.pending_modules.filter((m: any) => m.spec !== specId);
    global.in_progress_modules.push(entry);
    await fs.writeJSON(resolve(ws, 'sdd/global.json'), global, { spaces: 2 });
    const index = await fs.readJSON(resolve(ws, 'sdd/specs/index.json'));
    index.specs.find((s: any) => s.id === specId).status = 'in-progress';
    await fs.writeJSON(resolve(ws, 'sdd/specs/index.json'), index, { spaces: 2 });

    const approved = runGate('orders', 'cycle-01');
    expect(approved.status).toBe(0);
    expect(approved.output).toContain('APROBADO');

    // user_stories vacías son válidas en lite; plan.md es un archivo permitido en la raíz.
    const validated = runValidate();
    expect(validated.ok).toBe(true);
    expect(validated.output).not.toContain('empty user_stories');
    expect(validated.output).not.toContain('disallowed file');

    // Un segundo ciclo no se abre mientras el primero está in-progress.
    const reopen = runGate('orders');
    expect(reopen.status).toBe(1);
    expect(reopen.output).toContain('A3');
  });

  it('GATE B en flow full exige los cuatro documentos', async () => {
    const cycle = await fs.readJSON(resolve(cycleDir, 'cycle.json'));
    cycle.flow = 'full';
    await fs.writeJSON(resolve(cycleDir, 'cycle.json'), cycle);
    const run = runGate('orders', 'cycle-01');
    expect(run.status).toBe(1);
    expect(run.output).toContain('flow: full');
    expect(run.output).toContain('brief.yaml');
    expect(run.output).toContain('architect.md');
  });
});
