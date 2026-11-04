import { describe, it, expect } from 'vitest';
import { buildConfigCatalog, formatConfigCatalog } from '../catalog.js';
import { APP_TYPE_OPTIONS, LIB_TYPE_OPTIONS, SERVICE_OPTIONS } from '../app-options.js';
import {
  AUTHOR_PATTERN,
  AppTypeSchema,
  KEBAB_NAME_PATTERN,
  LibTypeSchema,
  PACKAGE_SCOPE_PATTERN,
  PORT_RANGE,
  ServiceTypeSchema,
} from '../schema.js';
import { TOLERATED_ENTRIES } from '../../generators/workspace.generator.js';
import { version } from '../../version.js';

describe('buildConfigCatalog', () => {
  const catalog = buildConfigCatalog();

  it('covers every app, lib and service type of init and of the schema', () => {
    const appTypes = catalog.appTypes.map((a) => a.type);
    expect(appTypes).toEqual(APP_TYPE_OPTIONS.map((o) => o.value));
    expect([...appTypes].sort()).toEqual([...AppTypeSchema.options].sort());
    expect(catalog.libTypes.map((l) => l.type)).toEqual(LIB_TYPE_OPTIONS.map((o) => o.value));
    expect([...catalog.libTypes.map((l) => l.type)].sort()).toEqual([...LibTypeSchema.options].sort());
    expect(catalog.serviceTypes.map((s) => s.type)).toEqual(SERVICE_OPTIONS.map((o) => o.value));
    expect([...catalog.serviceTypes.map((s) => s.type)].sort()).toEqual([...ServiceTypeSchema.options].sort());
  });

  it('takes patterns and port range from the exported constants', () => {
    expect(catalog.patterns).toEqual({
      name: KEBAB_NAME_PATTERN.source,
      packageScope: PACKAGE_SCOPE_PATTERN.source,
      author: AUTHOR_PATTERN.source,
    });
    expect(catalog.portRange).toEqual(PORT_RANGE);
    expect(new RegExp(catalog.patterns.name).test('my-app')).toBe(true);
    expect(new RegExp(catalog.patterns.name).test('My_App')).toBe(false);
  });

  it('flags app types by family', () => {
    const byType = Object.fromEntries(catalog.appTypes.map((a) => [a.type, a]));
    expect(byType['next-bff']).toMatchObject({ workspaceOnly: true, tucuUi: true, role: 'frontend' });
    expect(byType['mfe']).toMatchObject({ workspaceOnly: true, shell: true });
    expect(byType['mfe-shell']).toMatchObject({ workspaceOnly: true, shell: false });
    expect(byType['python']).toMatchObject({ ml: true, tucuUi: false, role: 'backend', defaultPort: 8000 });
    expect(byType['nestjs']).toMatchObject({ workspaceOnly: false, stackPlain: null, defaultName: 'api' });
    expect(byType['react'].stack).toContain('tucu-ui');
    expect(byType['react'].stackPlain).toContain('plain');
    expect(catalog.appTypes.filter((a) => a.ml)).toHaveLength(1);
    expect(catalog.appTypes.filter((a) => a.shell)).toHaveLength(1);
  });

  it('describes modes, profiles, services, tolerated entries and version', () => {
    expect(catalog.format).toBe(1);
    expect(catalog.cliVersion).toBe(version);
    expect(catalog.modes).toEqual([
      { mode: 'nx', maxApps: null, libs: true },
      { mode: 'standalone', maxApps: 1, libs: false },
    ]);
    expect(catalog.profiles).toEqual(['team', 'solo']);
    expect(catalog.serviceTypes.find((s) => s.type === 'postgres')).toMatchObject({ defaultPort: 5432, version: '16' });
    expect([...catalog.targetDir.tolerated].sort()).toEqual([...TOLERATED_ENTRIES].sort());
    expect(catalog.jsonSchema).toHaveProperty('properties.apps');
  });

  it('is JSON serializable and renders a readable table', () => {
    expect(JSON.parse(JSON.stringify(catalog))).toEqual(catalog);
    const text = formatConfigCatalog(catalog);
    expect(text).toContain('nestjs');
    expect(text).toContain('Tolerated target entries');
  });
});
