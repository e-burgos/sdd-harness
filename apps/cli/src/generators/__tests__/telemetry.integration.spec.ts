import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import { generateSDD } from '../sdd.generator.js';

// La telemetría (metrics.usage + approx/source) y tasks_skipped son aditivos:
// los registros escritos antes de v0.9.0 tienen que seguir validando en verde y
// el update del kit no puede convertir una omisión histórica en un error.
const REPO_ROOT = resolve(__dirname, '../../..');
const SCHEMAS = resolve(REPO_ROOT, 'templates/sdd/schemas');

const SPEC_ID = 'spec-eburgos-001-telemetry';
const CYCLE_DIR = `sdd/specs/${SPEC_ID}/cycles/cycle-01`;

function compile(schemaFile: string) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(fs.readJSONSync(resolve(SCHEMAS, schemaFile)));
}

function baseCycle(metrics: Record<string, unknown> | null) {
  return {
    cycle: 1,
    module: 'telemetry',
    spec: SPEC_ID,
    apps: ['apps/demo-api'],
    status: 'completed',
    started_at: '2026-08-18',
    completed_at: '2026-08-19',
    documents: {},
    artifacts: [],
    metrics,
    tables_created: [],
    endpoints_implemented: [],
    components_created: [],
    issues_found: [],
    reviewer_report: {
      approved: true,
      date: '2026-08-19',
      ca_results: {},
      tests: {},
      notes: 'n',
    },
  };
}

function baseMetrics(extra: Record<string, unknown> = {}) {
  return {
    tasks_total: 2,
    tasks_completed: 2,
    story_points: 3,
    files_created: [],
    files_modified: [],
    files_deleted: [],
    ...extra,
  };
}

describe('telemetría: compatibilidad de schemas', () => {
  const validateCycle = compile('cycle.schema.json');

  it('acepta un ciclo pre-v0.9.0 sin metrics.usage', () => {
    expect(validateCycle(baseCycle(baseMetrics()))).toBe(true);
  });

  it('acepta el usage de v0.7.0 (sin approx/source) y las claves de tier legacy', () => {
    const legacy = baseCycle(
      baseMetrics({
        usage: {
          tokens_in: 1000,
          tokens_out: 200,
          by_tier: { sonnet: { tokens_in: 1000, tokens_out: 200 } },
        },
      }),
    );
    expect(validateCycle(legacy)).toBe(true);
  });

  it('acepta un ciclo que mezcla un proveedor medido con uno estimado', () => {
    const mixed = baseCycle(
      baseMetrics({
        usage: {
          tokens_in: 600_000,
          tokens_out: 80_000,
          approx: true,
          source: 'declared-estimate',
          by_tier: {
            'claude/opus': {
              tokens_in: 120_000,
              tokens_out: 18_000,
              approx: false,
              source: 'session-report',
            },
            'copilot/claude-sonnet': {
              tokens_in: 480_000,
              tokens_out: 62_000,
              approx: true,
              source: 'declared-estimate',
            },
          },
        },
      }),
    );
    expect(validateCycle(mixed)).toBe(true);
  });

  it('acepta tasks_skipped y rechaza un source fuera del enum', () => {
    expect(
      validateCycle(
        baseCycle(baseMetrics({ tasks_completed: 1, tasks_skipped: 1 })),
      ),
    ).toBe(true);
    expect(
      validateCycle(
        baseCycle(
          baseMetrics({
            usage: { tokens_in: 1, tokens_out: 1, source: 'vibes' },
          }),
        ),
      ),
    ).toBe(false);
  });

  it('task y fix aceptan approx/source sin romper los registros previos', () => {
    const validateTasks = compile('cycle-tasks.schema.json');
    const task = {
      id: 'TASK-001',
      title: 'demo',
      user_stories: ['HU-01'],
      estimation_hours: 1,
      story_points: 1,
      depends_on: [],
      status: 'done',
      files: [],
    };
    const doc = (t: Record<string, unknown>) => ({
      spec: SPEC_ID,
      cycle: 1,
      module: 'telemetry',
      apps: ['apps/demo-api'],
      flow: 'full',
      user_stories_generated: true,
      prerequisites: { tasks_generated: true },
      tasks: [t],
    });

    expect(validateTasks(doc(task))).toBe(true);
    expect(
      validateTasks(
        doc({
          ...task,
          usage: { tokens_in: 1, tokens_out: 1, model_tier: 'sonnet' },
        }),
      ),
    ).toBe(true);
    expect(
      validateTasks(
        doc({
          ...task,
          status: 'skipped',
          usage: {
            tokens_in: 1,
            tokens_out: 1,
            model_tier: 'copilot/gpt-5-mini',
            approx: true,
            source: 'declared-estimate',
          },
        }),
      ),
    ).toBe(true);
  });
});

describe.skipIf(process.platform === 'win32')(
  'telemetría: reglas de validate-sdd',
  () => {
    let ws: string;

    // Los warnings salen por stderr y los errores por stdout+stderr: spawnSync
    // deja ver ambos, execFileSync solo devolvería stdout.
    const runValidate = (): { ok: boolean; output: string } => {
      const run = spawnSync('node', [resolve(ws, 'sdd/scripts/validate-sdd.mjs')], {
        encoding: 'utf-8',
      });
      return {
        ok: run.status === 0,
        output: `${run.stdout ?? ''}${run.stderr ?? ''}`,
      };
    };

    // El índice de tasks deriva del cycle.json, así que se regenera después de
    // escribirlo o validate-sdd lo reporta como stale.
    const writeCycle = async (metrics: Record<string, unknown>) => {
      await fs.writeJSON(resolve(ws, CYCLE_DIR, 'cycle.json'), {
        ...baseCycle(metrics),
        documents: {
          tasks: `${CYCLE_DIR}/tasks.json`,
        },
      });
      execFileSync('node', [resolve(ws, 'sdd/scripts/rebuild-tasks-index.mjs')], {
        stdio: 'ignore',
      });
    };

    beforeAll(async () => {
      ws = mkdtempSync(resolve(tmpdir(), 'harness-telemetry-'));
      await generateSDD(ws, {
        projectName: 'telemetry-proj',
        description: 'Workspace used to check the telemetry gate rules.',
        packageScope: '@telemetry',
        apps: [],
        libs: [],
        services: [],
      });

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
        if (fs.existsSync(src)) {
          await fs.ensureSymlink(src, resolve(ws, 'node_modules', dep));
        }
      }

      await fs.ensureDir(resolve(ws, CYCLE_DIR));
      await fs.ensureDir(resolve(ws, 'sdd/context/apps/demo-api/updates'));
      await fs.writeFile(
        resolve(
          ws,
          `sdd/context/apps/demo-api/updates/2026-08-19-${SPEC_ID}-cycle-01.md`,
        ),
        '# delta\n',
      );
      await fs.ensureDir(resolve(ws, `sdd/specs/${SPEC_ID}`));
      await fs.writeJSON(resolve(ws, 'sdd/specs/index.json'), {
        specs: [
          {
            id: SPEC_ID,
            author: 'eburgos',
            slug: 'telemetry',
            folder: `sdd/specs/${SPEC_ID}`,
            file: `sdd/specs/${SPEC_ID}/${SPEC_ID}.spec.md`,
            module: 'telemetry',
            app: 'apps/demo-api',
            status: 'in-progress',
            title: 'Telemetry',
            created_at: '2026-08-18',
            completed_at: null,
            depends_on: [],
          },
        ],
      });
      await fs.writeFile(
        resolve(ws, `sdd/specs/${SPEC_ID}/${SPEC_ID}.spec.md`),
        '# spec\n',
      );
      await fs.writeJSON(resolve(ws, CYCLE_DIR, 'tasks.json'), {
        spec: SPEC_ID,
        cycle: 1,
        module: 'telemetry',
        apps: ['apps/demo-api'],
        flow: 'full',
        user_stories_generated: true,
        prerequisites: { tasks_generated: true },
        tasks: [
          {
            id: 'TASK-001',
            title: 'hecha',
            user_stories: ['HU-01'],
            estimation_hours: 1,
            story_points: 1,
            depends_on: [],
            status: 'done',
            files: [],
          },
          {
            id: 'TASK-002',
            title: 'omitida',
            user_stories: ['HU-01'],
            estimation_hours: 1,
            story_points: 2,
            depends_on: [],
            status: 'skipped',
            files: [],
          },
        ],
      });
    }, 30_000);

    afterAll(() => {
      rmSync(ws, { recursive: true, force: true });
    });

    // El proyecto se llama telemetry-proj: una app telemetry-proj-api comparte el prefijo
    // y no debe disparar la regla de portabilidad (substring != nombre del proyecto).
    it('una app cuyo nombre extiende al del proyecto no dispara la regla de portabilidad', async () => {
      await writeCycle(baseMetrics({ tasks_completed: 1, tasks_skipped: 1 }));
      const readme = resolve(ws, 'sdd/README.md');
      const original = await fs.readFile(readme, 'utf-8');
      await fs.writeFile(readme, `${original}\n\nVer \`apps/telemetry-proj-api\` para la API.\n`);
      try {
        expect(runValidate().ok).toBe(true);
        await fs.writeFile(readme, `${original}\n\nEste repo es telemetry-proj.\n`);
        const leak = runValidate();
        expect(leak.ok).toBe(false);
        expect(leak.output).toContain('hardcodes global.json');
      } finally {
        await fs.writeFile(readme, original);
      }
    });

    it('un ciclo sin metrics.usage avisa pero NO falla (dato pre-v0.9.0)', async () => {
      await writeCycle(baseMetrics({ tasks_completed: 1, tasks_skipped: 1 }));
      const { ok, output } = runValidate();
      expect(ok).toBe(true);
      expect(output).toContain('without metrics.usage');
    });

    it('un ciclo con metrics: null también avisa por telemetría faltante', async () => {
      await fs.writeJSON(resolve(ws, CYCLE_DIR, 'cycle.json'), {
        ...baseCycle(null),
        documents: { tasks: `${CYCLE_DIR}/tasks.json` },
      });
      execFileSync('node', [resolve(ws, 'sdd/scripts/rebuild-tasks-index.mjs')], {
        stdio: 'ignore',
      });
      const { ok, output } = runValidate();
      expect(ok).toBe(true);
      expect(output).toContain('without metrics.usage');
    });

    it('metrics.usage sin by_tier avisa: falta declarar proveedor/modelo', async () => {
      await writeCycle(
        baseMetrics({
          tasks_completed: 1,
          tasks_skipped: 1,
          usage: { tokens_in: 10, tokens_out: 2 },
        }),
      );
      const { ok, output } = runValidate();
      expect(ok).toBe(true);
      expect(output).toContain('no by_tier');
    });

    it('una task skipped declarada en tasks_skipped cierra el ciclo en verde', async () => {
      await writeCycle(
        baseMetrics({
          tasks_completed: 1,
          tasks_skipped: 1,
          usage: {
            tokens_in: 10,
            tokens_out: 2,
            approx: true,
            source: 'declared-estimate',
            by_tier: {
              'copilot/claude-sonnet': {
                tokens_in: 10,
                tokens_out: 2,
                approx: true,
                source: 'declared-estimate',
              },
            },
          },
        }),
      );
      const { ok, output } = runValidate();
      expect(ok).toBe(true);
      expect(output).toContain('OK');
      expect(output).not.toContain('without metrics.usage');
    });

    it('una task skipped no declarada deja el ciclo incompleto', async () => {
      await writeCycle(baseMetrics({ tasks_completed: 1, tasks_skipped: 0 }));
      const { ok, output } = runValidate();
      expect(ok).toBe(false);
      expect(output).toContain('1/2 tasks resolved');
      expect(output).toContain('metrics.tasks_skipped is 0');
    });
  },
);
