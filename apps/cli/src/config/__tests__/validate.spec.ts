import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import {
  ConfigReadError,
  MAX_CONFIG_BYTES,
  readRawConfigFromStream,
  validateHarnessConfig,
} from '../validate.js';
import { version } from '../../version.js';

const project = { name: 'shop', description: 'tienda', packageScope: '@shop' };
const codes = (raw: unknown, severity: 'error' | 'warning') =>
  validateHarnessConfig(raw)
    .issues.filter((i) => i.severity === severity)
    .map((i) => i.code);

describe('validateHarnessConfig: valid configs', () => {
  it('resolves ports, tucu-ui, stack, paths and docker for a monorepo', () => {
    const result = validateHarnessConfig({
      project,
      apps: [
        { name: 'api', type: 'nestjs' },
        { name: 'api2', type: 'fastify' },
        { name: 'web', type: 'react', tucuUi: false },
        { name: 'site', type: 'nextjs' },
      ],
      libs: [{ name: 'types', type: 'shared-types' }],
      services: [{ type: 'postgres' }],
    });
    expect(result).toMatchObject({ format: 1, cliVersion: version, ok: true, issues: [] });
    const resolved = result.resolved!;
    expect(resolved.mode).toBe('nx');
    expect(resolved.profile).toBe('team');
    expect(resolved.dockerCompose).toBe(true);
    expect(resolved.services).toEqual([{ type: 'postgres', port: 5432, version: '16' }]);
    expect(resolved.libs).toEqual([{ name: 'types', type: 'shared-types', path: 'libs/types' }]);
    const [api, api2, web, site] = resolved.apps;
    expect([api.port, api.portSource, api.path, api.tucuUi]).toEqual([3000, 'default', 'apps/api', null]);
    expect([api2.port, api2.portSource]).toEqual([3001, 'shifted']);
    expect([web.tucuUi, web.stack]).toEqual([false, expect.stringContaining('plain')]);
    expect(site.tucuUi).toBe(true);
    expect(site.port).toBe(3002);
  });

  it('honours explicit ports, sdd.profile and sdd.tucu_ui', () => {
    const result = validateHarnessConfig({
      project,
      apps: [{ name: 'web', type: 'react', port: 5000 }],
      sdd: { profile: 'solo', tucu_ui: false },
    });
    expect(result.resolved!.profile).toBe('solo');
    expect(result.resolved!.apps[0]).toMatchObject({ port: 5000, portSource: 'explicit', tucuUi: false });
    expect(result.resolved!.dockerCompose).toBe(false);
  });

  it('resolves the shell and route of an mfe, implicit and explicit', () => {
    const result = validateHarnessConfig({
      project,
      apps: [
        { name: 'portal', type: 'mfe-shell' },
        { name: 'catalog', type: 'mfe' },
      ],
    });
    const mfe = result.resolved!.apps[1];
    expect([mfe.shell, mfe.route]).toEqual(['portal', '/catalog/']);
    expect(result.resolved!.apps[0]).toMatchObject({ shell: null, route: null });
  });

  it('resolves a standalone app at the root and drops libs with a warning', () => {
    const result = validateHarnessConfig({
      mode: 'standalone',
      project,
      apps: [{ name: 'api', type: 'hono' }],
      libs: [{ name: 'types', type: 'shared-types' }],
    });
    expect(result.ok).toBe(true);
    expect(result.resolved!.apps[0].path).toBe('.');
    expect(result.resolved!.libs).toEqual([]);
    expect(result.issues).toMatchObject([{ severity: 'warning', code: 'standalone-libs-ignored', path: ['libs'] }]);
  });
});

describe('validateHarnessConfig: errors', () => {
  it('reports schema issues with zod code and path and no resolved preview', () => {
    const result = validateHarnessConfig({
      project: { ...project, name: 'Shop' },
      apps: [{ name: 'api', type: 'django' }],
    });
    expect(result.ok).toBe(false);
    expect(result.resolved).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'error', code: 'invalid_string', path: ['project', 'name'] }),
        expect.objectContaining({ severity: 'error', code: 'invalid_enum_value', path: ['apps', 0, 'type'] }),
      ]),
    );
  });

  it('reports a non-object config at the root', () => {
    const result = validateHarnessConfig([]);
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatchObject({ severity: 'error', path: [] });
  });

  it('reports topology as structured issues, once, with path to the field', () => {
    const result = validateHarnessConfig({
      project,
      apps: [
        { name: 'api', type: 'nestjs', ml: true },
        { name: 'm', type: 'mfe' },
      ],
    });
    expect(result.issues.map((i) => [i.code, i.path])).toEqual([
      ['ml-not-python', ['apps', 0, 'ml']],
      ['shell-missing', ['apps', 1, 'shell']],
    ]);
  });

  it('reports topology even when another field already fails the schema', () => {
    expect(codes({ project: { ...project, name: 'X' }, apps: [{ name: 'm', type: 'mfe' }] }, 'error')).toEqual(
      expect.arrayContaining(['invalid_string', 'shell-missing']),
    );
  });

  it('reports workspace-only types in standalone and the app count', () => {
    expect(codes({ mode: 'standalone', project, apps: [{ name: 'b', type: 'next-bff' }] }, 'error')).toEqual([
      'workspace-only-type',
    ]);
    const two = validateHarnessConfig({
      mode: 'standalone',
      project,
      apps: [
        { name: 'a', type: 'nestjs' },
        { name: 'b', type: 'hono' },
      ],
    });
    expect(two.issues).toMatchObject([{ code: 'standalone-app-count', path: ['apps'] }]);
  });

  it('reports duplicate app and lib names on the repeated row', () => {
    const result = validateHarnessConfig({
      project,
      apps: [
        { name: 'api', type: 'nestjs' },
        { name: 'api', type: 'hono', port: 4000 },
      ],
      libs: [
        { name: 'x', type: 'config' },
        { name: 'x', type: 'ui-kit' },
      ],
    });
    expect(result.issues.map((i) => [i.code, i.path])).toEqual([
      ['duplicate-app-name', ['apps', 1, 'name']],
      ['duplicate-lib-name', ['libs', 1, 'name']],
    ]);
  });
});

describe('validateHarnessConfig: warnings', () => {
  it('warns on explicit port conflicts, one issue per row', () => {
    const result = validateHarnessConfig({
      project,
      apps: [
        { name: 'a', type: 'nestjs', port: 4000 },
        { name: 'b', type: 'hono', port: 4000 },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.issues.map((i) => [i.severity, i.code, i.path])).toEqual([
      ['warning', 'port-conflict', ['apps', 0, 'port']],
      ['warning', 'port-conflict', ['apps', 1, 'port']],
    ]);
    expect(result.resolved).not.toBeNull();
  });

  it('warns when an app takes the port of a service', () => {
    const result = validateHarnessConfig({
      project,
      apps: [{ name: 'db-ui', type: 'nestjs', port: 5432 }],
      services: [{ type: 'postgres' }],
    });
    expect(result.issues.map((i) => i.path)).toEqual([
      ['apps', 0, 'port'],
      ['services', 0, 'type'],
    ]);
  });

  it('does not warn when default ports shift to avoid each other', () => {
    expect(
      validateHarnessConfig({
        project,
        apps: [
          { name: 'a', type: 'nestjs' },
          { name: 'b', type: 'hono' },
        ],
      }).issues,
    ).toEqual([]);
  });
});

describe('readRawConfigFromStream', () => {
  it('parses JSON and rejects invalid JSON', async () => {
    await expect(readRawConfigFromStream(Readable.from(['{"a":', '1}']))).resolves.toEqual({ a: 1 });
    await expect(readRawConfigFromStream(Readable.from(['nope']))).rejects.toBeInstanceOf(ConfigReadError);
  });

  it('rejects input above MAX_CONFIG_BYTES', async () => {
    const big = Readable.from([Buffer.alloc(MAX_CONFIG_BYTES), Buffer.from('x')]);
    await expect(readRawConfigFromStream(big)).rejects.toThrow(/exceeds/);
  });
});
