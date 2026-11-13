import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

import { HarnessConfigSchema } from '../schema.js';
import {
  loadHarnessConfig,
  toStandaloneOptions,
  toWorkspaceOptions,
} from '../load.js';

const VALID_CONFIG = {
  mode: 'nx',
  project: {
    name: 'idea-app',
    description: 'Generated from a natural-language idea.',
    packageScope: '@idea-app',
  },
  apps: [
    { name: 'core-api', type: 'nestjs' },
    { name: 'web', type: 'react' },
  ],
  libs: [{ name: 'shared-types', type: 'shared-types' }],
  services: [{ type: 'postgres' }, { type: 'redis', port: 6380 }],
};

describe('config/load', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), 'harness-config-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const writeConfig = async (content: unknown, file = 'harness.config.json') => {
    const path = resolve(dir, file);
    await fs.writeJSON(path, content);
    return path;
  };

  it('carga y valida un config JSON completo', async () => {
    const config = await loadHarnessConfig(await writeConfig(VALID_CONFIG));
    expect(config.mode).toBe('nx');
    expect(config.apps).toHaveLength(2);
    expect(config.libs).toEqual([{ name: 'shared-types', type: 'shared-types' }]);
  });

  it('aplica defaults: mode nx, libs y services vacíos', async () => {
    const config = await loadHarnessConfig(
      await writeConfig({
        project: VALID_CONFIG.project,
        apps: [{ name: 'core-api', type: 'nestjs' }],
      }),
    );
    expect(config.mode).toBe('nx');
    expect(config.libs).toEqual([]);
    expect(config.services).toEqual([]);
  });

  it('rechaza tipos de app desconocidos con el path del error', async () => {
    const path = await writeConfig({
      project: VALID_CONFIG.project,
      apps: [{ name: 'core-api', type: 'django' }],
    });
    await expect(loadHarnessConfig(path)).rejects.toThrow(/apps\.0\.type/);
  });

  // La vía no interactiva tiene que cubrir los mismos tipos que el wizard:
  // springboot y hono salen de blueprints y antes sólo eran alcanzables a mano.
  it('acepta los siete tipos de app que ofrece el wizard', async () => {
    const path = await writeConfig({
      project: VALID_CONFIG.project,
      apps: [
        { name: 'core-api', type: 'nestjs' },
        { name: 'web', type: 'react' },
        { name: 'agent', type: 'python' },
        { name: 'site', type: 'nextjs' },
        { name: 'edge', type: 'fastify' },
        { name: 'orders-api', type: 'springboot' },
        { name: 'gateway', type: 'hono' },
      ],
    });
    const config = await loadHarnessConfig(path);
    expect(config.apps.map((a) => a.type)).toEqual([
      'nestjs',
      'react',
      'python',
      'nextjs',
      'fastify',
      'springboot',
      'hono',
    ]);
  });

  it('acepta springboot como única app en standalone', async () => {
    const config = await loadHarnessConfig(
      await writeConfig({
        mode: 'standalone',
        project: VALID_CONFIG.project,
        apps: [{ name: 'orders-api', type: 'springboot' }],
      }),
    );
    expect(toStandaloneOptions(config).appType).toBe('springboot');
  });

  it('rechaza nombres que no sean kebab-case', async () => {
    const path = await writeConfig({
      project: { ...VALID_CONFIG.project, name: 'IdeaApp' },
      apps: [{ name: 'core-api', type: 'nestjs' }],
    });
    await expect(loadHarnessConfig(path)).rejects.toThrow(/kebab-case/);
  });

  it('falla claro con archivo inexistente y con extensión no soportada', async () => {
    await expect(loadHarnessConfig(resolve(dir, 'missing.json'))).rejects.toThrow(
      /not found/,
    );
    const yaml = resolve(dir, 'harness.config.yaml');
    await fs.writeFile(yaml, 'mode: nx', 'utf-8');
    await expect(loadHarnessConfig(yaml)).rejects.toThrow(/Unsupported/);
  });

  it('mapea a WorkspaceOptions con services como tipos planos', async () => {
    const config = await loadHarnessConfig(await writeConfig(VALID_CONFIG));
    expect(toWorkspaceOptions(config)).toEqual({
      projectName: 'idea-app',
      description: 'Generated from a natural-language idea.',
      packageScope: '@idea-app',
      apps: [
        { name: 'core-api', type: 'nestjs', port: undefined },
        { name: 'web', type: 'react', port: undefined },
      ],
      libs: [{ name: 'shared-types', type: 'shared-types' }],
      services: ['postgres', 'redis'],
      npmScopes: [],
      sddAuthor: undefined,
      sddProfile: undefined,
      modules: [],
    });
  });

  it('baja port, npm.scopes, sdd.author y sdd.modules normalizados a las opciones', async () => {
    const config = await loadHarnessConfig(
      await writeConfig({
        ...VALID_CONFIG,
        apps: [{ name: 'core-api', type: 'nestjs', port: 3100 }],
        npm: { scopes: [{ scope: '@acme', registry: 'https://npm.pkg.github.com' }] },
        sdd: {
          author: 'jdoe',
          modules: ['catalog', { name: 'search', depends_on: ['catalog'] }],
        },
      }),
    );
    const options = toWorkspaceOptions(config);
    expect(options.apps).toEqual([{ name: 'core-api', type: 'nestjs', port: 3100 }]);
    expect(options.npmScopes).toEqual([
      { scope: '@acme', registry: 'https://npm.pkg.github.com' },
    ]);
    expect(options.sddAuthor).toBe('jdoe');
    expect(options.modules).toEqual([
      { name: 'catalog', depends_on: [] },
      { name: 'search', depends_on: ['catalog'] },
    ]);
  });

  it('precedencia de tucu-ui en las opciones: flag > apps[].tucuUi > sdd.tucu_ui', async () => {
    const config = await loadHarnessConfig(
      await writeConfig(
        {
          ...VALID_CONFIG,
          apps: [
            { name: 'core-api', type: 'nestjs' },
            { name: 'web', type: 'react', tucuUi: true },
            { name: 'site', type: 'nextjs' },
            { name: 'blog', type: 'nextjs', tucuUi: false },
          ],
          sdd: { tucu_ui: false },
        },
        'precedence.json',
      ),
    );
    const resolved = (flag?: boolean) =>
      toWorkspaceOptions(config, { tucuUi: flag }).apps.map((a) => a.tucuUi);
    expect(resolved()).toEqual([undefined, true, false, false]);
    expect(resolved(false)).toEqual([undefined, false, false, false]);
    expect(resolved(true)).toEqual([undefined, true, true, true]);
  });

  it('rechaza ml fuera de python y tucuUi fuera de apps frontend', async () => {
    await expect(
      loadHarnessConfig(
        await writeConfig(
          { ...VALID_CONFIG, apps: [{ name: 'core-api', type: 'nestjs', ml: true }] },
          'bad-ml.json',
        ),
      ),
    ).rejects.toThrow(/"ml" is only valid/);
    await expect(
      loadHarnessConfig(
        await writeConfig(
          { ...VALID_CONFIG, apps: [{ name: 'core-api', type: 'nestjs', tucuUi: false }] },
          'bad-ui.json',
        ),
      ),
    ).rejects.toThrow(/"tucuUi" is only valid/);
  });

  it('rechaza scopes npm sin @ y módulos que no sean kebab-case', async () => {
    await expect(
      loadHarnessConfig(
        await writeConfig({
          ...VALID_CONFIG,
          npm: { scopes: [{ scope: 'acme', registry: 'https://npm.pkg.github.com' }] },
        }),
      ),
    ).rejects.toThrow(/npm\.scopes\.0\.scope/);
    await expect(
      loadHarnessConfig(
        await writeConfig({ ...VALID_CONFIG, sdd: { modules: ['Catalog Core'] } }, 'm.json'),
      ),
    ).rejects.toThrow(/sdd\.modules\.0/);
  });

  it('sdd.tucu_ui es opcional y booleano', async () => {
    const absent = await loadHarnessConfig(await writeConfig(VALID_CONFIG));
    expect(absent.sdd?.tucu_ui).toBeUndefined();

    const on = await loadHarnessConfig(
      await writeConfig({ ...VALID_CONFIG, sdd: { tucu_ui: true } }, 'on.json'),
    );
    expect(on.sdd?.tucu_ui).toBe(true);

    const off = await loadHarnessConfig(
      await writeConfig({ ...VALID_CONFIG, sdd: { tucu_ui: false } }, 'off.json'),
    );
    expect(off.sdd?.tucu_ui).toBe(false);

    await expect(
      loadHarnessConfig(
        await writeConfig({ ...VALID_CONFIG, sdd: { tucu_ui: 'yes' } }, 'bad.json'),
      ),
    ).rejects.toThrow(/sdd\.tucu_ui/);
  });

  it('apps[].tucuUi es opcional, booleano y el flag de CLI gana sobre el valor de la app', async () => {
    const absent = await loadHarnessConfig(await writeConfig(VALID_CONFIG));
    expect(absent.apps[1].tucuUi).toBeUndefined();

    const config = await loadHarnessConfig(
      await writeConfig(
        {
          ...VALID_CONFIG,
          apps: [
            { name: 'core-api', type: 'nestjs' },
            { name: 'web', type: 'react', tucuUi: true },
            { name: 'site', type: 'nextjs' },
          ],
        },
        'tucu.json',
      ),
    );
    expect(toWorkspaceOptions(config).apps.map((a) => a.tucuUi)).toEqual([undefined, true, undefined]);
    expect(toWorkspaceOptions(config, { tucuUi: false }).apps.map((a) => a.tucuUi)).toEqual([
      undefined,
      false,
      false,
    ]);
    expect(toWorkspaceOptions(config, { tucuUi: true }).apps.map((a) => a.tucuUi)).toEqual([
      undefined,
      true,
      true,
    ]);

    await expect(
      loadHarnessConfig(
        await writeConfig(
          { ...VALID_CONFIG, apps: [{ name: 'web', type: 'react', tucuUi: 'yes' }] },
          'bad-tucu.json',
        ),
      ),
    ).rejects.toThrow(/apps\.0\.tucuUi/);
  });

  it('standalone exige exactamente una app', async () => {
    const config = await loadHarnessConfig(
      await writeConfig({
        ...VALID_CONFIG,
        mode: 'standalone',
        apps: [{ name: 'solo-api', type: 'fastify' }],
      }),
    );
    expect(toStandaloneOptions(config)).toEqual({
      projectName: 'idea-app',
      description: 'Generated from a natural-language idea.',
      appType: 'fastify',
      port: undefined,
      services: ['postgres', 'redis'],
      npmScopes: [],
      sddAuthor: undefined,
      modules: [],
    });

    const multi = await loadHarnessConfig(
      await writeConfig({ ...VALID_CONFIG, mode: 'standalone' }, 'multi.json'),
    );
    expect(() => toStandaloneOptions(multi)).toThrow(/exactly one app/);
  });

  describe('nx.version', () => {
    it('lo acepta y llega a las opciones del workspace; el flag gana sobre el config', () => {
      const config = HarnessConfigSchema.parse({ ...VALID_CONFIG, nx: { version: 22 } });
      expect(toWorkspaceOptions(config).nxMajor).toBe(22);
      expect(toWorkspaceOptions(config, { nxMajor: 23 }).nxMajor).toBe(23);
      expect(toWorkspaceOptions(HarnessConfigSchema.parse(VALID_CONFIG)).nxMajor).toBeUndefined();
    });

    it('rechaza mayores fuera de 22|23|24', () => {
      expect(HarnessConfigSchema.safeParse({ ...VALID_CONFIG, nx: { version: 21 } }).success).toBe(false);
      expect(HarnessConfigSchema.safeParse({ ...VALID_CONFIG, nx: { version: '24' } }).success).toBe(false);
    });
  });
});
