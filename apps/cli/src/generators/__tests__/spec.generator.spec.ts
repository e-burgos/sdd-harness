import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import { generateSDD } from '../sdd.generator.js';
import { createSpec, seedModules } from '../spec.generator.js';

vi.mock('../../utils/exec.js', () => ({
  exec: vi.fn(() => ''),
  execSilent: vi.fn(() => ''),
}));

// BUG-4 del uso real (2026-09-02): `add spec` registraba la spec en specs/index.json pero
// jamás en pending_modules de global.json, y `sdd.modules` del config no hacía nada. El
// orquestador no encontraba nada que arrancar; hubo que escribir el ModuleEntry a mano.
const REPO_ROOT = resolve(__dirname, '../../..');
const SCHEMAS = resolve(REPO_ROOT, 'templates/sdd/schemas');

function compile(schemaFile: string) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(fs.readJSONSync(resolve(SCHEMAS, schemaFile)));
}

describe('spec.generator', () => {
  let ws: string;

  beforeEach(async () => {
    ws = mkdtempSync(resolve(tmpdir(), 'harness-spec-'));
    await generateSDD(ws, {
      projectName: 'catalog-platform',
      description: 'Workspace used to check spec creation and module registration.',
      packageScope: '@catalog',
      apps: [
        { name: 'catalog-api', type: 'nestjs' },
        { name: 'catalog-web', type: 'react' },
      ],
      libs: [],
      services: [],
    });
  });

  afterEach(() => {
    rmSync(ws, { recursive: true, force: true });
  });

  it('crea la spec como draft y registra el módulo en pending_modules', async () => {
    const result = await createSpec(ws, {
      slug: 'catalog-core',
      author: 'eburgos',
      title: 'Catalog core',
      app: 'apps/catalog-api',
      apps: ['apps/catalog-web', 'apps/catalog-api'],
    });

    expect(result.specId).toBe('spec-eburgos-001-catalog-core');
    expect(fs.existsSync(resolve(ws, result.file))).toBe(true);
    expect(fs.existsSync(resolve(ws, result.folder, 'cycles/.gitkeep'))).toBe(true);

    const index = fs.readJSONSync(resolve(ws, 'sdd/specs/index.json'));
    expect(index.specs).toHaveLength(1);
    expect(index.specs[0]).toMatchObject({
      id: 'spec-eburgos-001-catalog-core',
      status: 'draft',
      app: 'apps/catalog-api',
      completed_at: null,
      depends_on: [],
    });

    const global = fs.readJSONSync(resolve(ws, 'sdd/global.json'));
    expect(global.pending_modules).toEqual([
      {
        module: 'catalog-core',
        spec: 'spec-eburgos-001-catalog-core',
        apps: ['apps/catalog-api', 'apps/catalog-web'],
        cycles_completed: 0,
        description: 'Catalog core',
      },
    ]);

    expect(compile('specs-index.schema.json')(index)).toBe(true);
    expect(compile('global.schema.json')(global)).toBe(true);
  });

  it('resuelve --depends-on por id o por slug y lo deja en el índice', async () => {
    const core = await createSpec(ws, {
      slug: 'catalog-core',
      author: 'eburgos',
      app: 'apps/catalog-api',
    });
    const search = await createSpec(ws, {
      slug: 'catalog-search',
      author: 'eburgos',
      app: 'apps/catalog-api',
      dependsOn: ['catalog-core'],
    });
    const admin = await createSpec(ws, {
      slug: 'admin-backoffice',
      author: 'eburgos',
      app: 'apps/catalog-web',
      dependsOn: [core.specId, 'catalog-search', 'catalog-core'],
    });

    expect(search.specId).toBe('spec-eburgos-002-catalog-search');
    expect(search.dependsOn).toEqual([core.specId]);
    expect(admin.dependsOn).toEqual([core.specId, search.specId]);

    const index = fs.readJSONSync(resolve(ws, 'sdd/specs/index.json'));
    expect(index.specs[2].depends_on).toEqual([core.specId, search.specId]);

    await expect(
      createSpec(ws, {
        slug: 'reports',
        author: 'eburgos',
        app: 'apps/catalog-api',
        dependsOn: ['does-not-exist'],
      }),
    ).rejects.toThrow(/does-not-exist/);
  });

  it('el contador NNN es por autor y rechaza subproyectos mal formados', async () => {
    await createSpec(ws, { slug: 'a', author: 'eburgos', app: 'apps/catalog-api' });
    const other = await createSpec(ws, { slug: 'b', author: 'jdoe', app: 'apps/catalog-api' });
    expect(other.specId).toBe('spec-jdoe-001-b');

    await expect(
      createSpec(ws, { slug: 'c', author: 'jdoe', app: 'catalog-api' }),
    ).rejects.toThrow(/\(apps\|libs\|tools\)/);
  });

  it('seedModules siembra sdd.modules en orden con depends_on por slug', async () => {
    const seeded = await seedModules(
      ws,
      [
        { name: 'catalog-core', depends_on: [] },
        {
          name: 'catalog-search',
          title: 'Catalog search',
          apps: ['apps/catalog-api', 'apps/catalog-web'],
          depends_on: ['catalog-core'],
        },
        { name: 'admin-backoffice', app: 'apps/catalog-web', depends_on: ['catalog-search'] },
      ],
      { author: 'eburgos', defaultApp: 'apps/catalog-api' },
    );

    expect(seeded.map((s) => s.specId)).toEqual([
      'spec-eburgos-001-catalog-core',
      'spec-eburgos-002-catalog-search',
      'spec-eburgos-003-admin-backoffice',
    ]);

    const global = fs.readJSONSync(resolve(ws, 'sdd/global.json'));
    expect(global.pending_modules.map((m: { module: string }) => m.module)).toEqual([
      'catalog-core',
      'catalog-search',
      'admin-backoffice',
    ]);
    expect(global.pending_modules[1].apps).toEqual(['apps/catalog-api', 'apps/catalog-web']);
    expect(global.pending_modules[2].apps).toEqual(['apps/catalog-web']);

    const index = fs.readJSONSync(resolve(ws, 'sdd/specs/index.json'));
    expect(index.specs.every((s: { status: string }) => s.status === 'draft')).toBe(true);
    expect(index.specs[2].depends_on).toEqual(['spec-eburgos-002-catalog-search']);
  });
});
