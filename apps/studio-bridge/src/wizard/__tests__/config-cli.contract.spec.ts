import { existsSync } from 'node:fs';
import path from 'node:path';
import { ConfigCatalog, ConfigValidation } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import { createConfigCli } from '../config-cli';
import { locateHarnessCli } from '../cli-locator';

const cli = locateHarnessCli();
const built = existsSync(path.join(path.dirname(cli.bin), '..', 'dist', 'cli.js'));

describe.skipIf(!built)('real harness CLI contract', () => {
  const configCli = createConfigCli({ cli });

  it('config catalog --json parses with the protocol schema', async () => {
    const catalog = await configCli.catalog();
    expect(ConfigCatalog.safeParse(catalog).success).toBe(true);
    expect(catalog.cliVersion).toBe(cli.version);
    expect(catalog.appTypes.length).toBeGreaterThan(0);
  });

  it('config validate - --json parses with the protocol schema for an invalid and a valid config', async () => {
    const invalid = await configCli.validate({});
    expect(ConfigValidation.safeParse(invalid).success).toBe(true);
    expect(invalid.ok).toBe(false);

    const valid = await configCli.validate({
      project: { name: 'contract-check', packageScope: '@contract-check' },
      apps: [{ name: 'api', type: 'nestjs' }],
    });
    expect(ConfigValidation.safeParse(valid).success).toBe(true);
  });

  const project = { name: 'contract-check', description: 'd', packageScope: '@contract-check' };
  const longName = (length: number) => `a${'b'.repeat(length - 1)}`;

  it.each([
    ['mfe-shell with two mfe', { project, apps: [{ name: 'portal', type: 'mfe-shell' }, { name: 'catalog', type: 'mfe' }, { name: 'orders', type: 'mfe' }] }, true],
    ['port-conflict warning', { project, apps: [{ name: 'a', type: 'nestjs', port: 4000 }, { name: 'b', type: 'hono', port: 4000 }] }, true],
    ['standalone app', { mode: 'standalone', project, apps: [{ name: 'api', type: 'hono' }] }, true],
    ['names at the length limit', { project: { name: longName(64), description: 'd', packageScope: `@${'s'.repeat(63)}` }, apps: [{ name: longName(64), type: 'nestjs' }] }, true],
    ['names above the length limit', { project: { name: longName(65), description: 'd', packageScope: `@${'s'.repeat(64)}` }, apps: [{ name: longName(65), type: 'nestjs' }] }, false],
    ['mfe without shell', { project, apps: [{ name: 'orphan', type: 'mfe' }] }, false],
    ['standalone with two apps', { mode: 'standalone', project, apps: [{ name: 'a', type: 'hono' }, { name: 'b', type: 'nestjs' }] }, false],
  ])('answers in the protocol shape for %s', async (_label, config, ok) => {
    const validation = await configCli.validate(config);
    expect(ConfigValidation.safeParse(validation).success).toBe(true);
    expect(validation.ok).toBe(ok);
    expect(await configCli.validateExact(config)).toEqual(validation);
  });

  it('reports port conflicts as warnings that keep the config valid', async () => {
    const validation = await configCli.validate({ project, apps: [{ name: 'a', type: 'nestjs', port: 4000 }, { name: 'b', type: 'hono', port: 4000 }] });
    expect(validation.issues.map((issue) => [issue.severity, issue.code])).toContainEqual(['warning', 'port-conflict']);
  });

  it('resolves the shell and route of every mfe', async () => {
    const validation = await configCli.validate({ project, apps: [{ name: 'portal', type: 'mfe-shell' }, { name: 'catalog', type: 'mfe' }, { name: 'orders', type: 'mfe' }] });
    expect(validation.resolved?.apps.map((app) => [app.shell, app.route])).toEqual([[null, null], ['portal', '/catalog/'], ['portal', '/orders/']]);
  });

  it('flags over-limit names as CLI issues and never as a protocol mismatch', async () => {
    const validation = await configCli.validate({ project: { ...project, name: longName(65) }, apps: [{ name: longName(65), type: 'nestjs' }] });
    expect(validation.ok).toBe(false);
    expect(validation.issues.map((issue) => issue.path.join('.'))).toEqual(expect.arrayContaining(['project.name', 'apps.0.name']));
  });

  it('exposes the same limits as the protocol caps', async () => {
    const catalog = await configCli.catalog();
    expect(catalog.limits).toMatchObject({ nameMax: 64, packageScopeMax: 64, maxApps: 32, maxLibs: 32, maxServices: 16, configBytes: 65_536 });
  });
});
