import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

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
        { name: 'core-api', type: 'nestjs' },
        { name: 'web', type: 'react' },
      ],
      libs: [{ name: 'shared-types', type: 'shared-types' }],
      services: ['postgres', 'redis'],
    });
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
      services: ['postgres', 'redis'],
    });

    const multi = await loadHarnessConfig(
      await writeConfig({ ...VALID_CONFIG, mode: 'standalone' }, 'multi.json'),
    );
    expect(() => toStandaloneOptions(multi)).toThrow(/exactly one app/);
  });
});
