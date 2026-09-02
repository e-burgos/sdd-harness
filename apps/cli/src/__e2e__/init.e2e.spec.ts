import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

/**
 * E2E real (opt-in): `harness idea` + `init --config` en un directorio ya git-inicializado,
 * con pnpm install y `nx run-many -t lint test build` de verdad. Tarda varios minutos y
 * necesita red, así que solo corre con HARNESS_E2E=1 (y `npm run build` previo: usa dist/).
 *
 *   HARNESS_E2E=1 npx vitest run src/__e2e__
 *
 * Reproduce el uso real del 2026-09-02 (BUG-1..4): generación en el cwd, harness.* conservados,
 * puertos del config en el código, NestJS + React en verde, specs sembradas como draft.
 */
const REPO_ROOT = resolve(__dirname, '../..');
const BIN = resolve(REPO_ROOT, 'bin/harness.mjs');

describe.skipIf(!process.env['HARNESS_E2E'])('e2e: idea + init --config in a git repo', () => {
  let root: string;

  beforeAll(() => {
    const parent = mkdtempSync(resolve(tmpdir(), 'harness-e2e-'));
    root = resolve(parent, 'catalog-platform');
    fs.ensureDirSync(root);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'e2e@example.com'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'e2e'], { cwd: root });
  });

  // node_modules de un workspace Nx real: borrarlo supera el timeout default de 10s.
  afterAll(() => {
    if (root) rmSync(resolve(root, '..'), { recursive: true, force: true });
  }, 5 * 60 * 1000);

  it('generates in place, keeps harness.*, honors ports and passes the lint/test/build gate', () => {
    // Never let an IDE-level NX_WORKSPACE_ROOT_PATH point nx at another repo (BUG of 2026-09-02).
    const { NX_WORKSPACE_ROOT_PATH: _ignored, ...env } = process.env;
    void _ignored;

    execFileSync(process.execPath, [BIN, 'idea', 'catálogo de plataforma', '--author', 'e2e'], {
      cwd: root,
      env,
      stdio: 'pipe',
    });
    const config = fs.readJSONSync(resolve(root, 'harness.config.json'));
    config.project = {
      name: 'catalog-platform',
      description: 'E2E catalog platform.',
      packageScope: '@catalog',
    };
    config.apps = [
      { name: 'catalog-api', type: 'nestjs', port: 3100 },
      { name: 'catalog-web', type: 'react', port: 4300 },
    ];
    config.libs = [{ name: 'shared-types', type: 'shared-types' }];
    config.sdd = { author: 'e2e', modules: ['catalog-core'] };
    fs.writeJSONSync(resolve(root, 'harness.config.json'), config, { spaces: 2 });

    const run = spawnSync(
      process.execPath,
      [BIN, 'init', '--config', './harness.config.json', '-y'],
      { cwd: root, env, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
    );
    const output = `${run.stdout}${run.stderr}`;
    expect(run.status, output.slice(-4000)).toBe(0);

    expect(fs.existsSync(resolve(root, 'catalog-platform'))).toBe(false);
    expect(fs.existsSync(resolve(root, 'nx.json'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'harness.idea.md'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'harness.config.json'))).toBe(true);
    expect(output).toContain('[x] sdd:validate');
    expect(output).toContain('[x] nx run-many -t lint test build');

    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: root,
      encoding: 'utf-8',
    }).trim();
    expect(branch).toBe('main');
    expect(fs.existsSync(resolve(root, 'dist/apps/catalog-api/main.js'))).toBe(true);
    expect(fs.readFileSync(resolve(root, '.env.example'), 'utf-8')).toContain('CATALOG_API_PORT=3100');

    const global = fs.readJSONSync(resolve(root, 'sdd/global.json'));
    expect(global.pending_modules[0].spec).toBe('spec-e2e-001-catalog-core');
  }, 15 * 60 * 1000);
});
