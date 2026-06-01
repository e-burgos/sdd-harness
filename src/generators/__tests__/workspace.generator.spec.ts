import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

import { generateWorkspace } from '../workspace.generator.js';

// Mock exec para evitar ejecutar git init y pnpm install en tests
vi.mock('../../utils/exec.js', () => ({
  exec: vi.fn(() => ''),
  execSilent: vi.fn(() => ''),
}));

describe('workspace.generator', () => {
  let parentDir: string;
  let originalCwd: string;

  beforeEach(() => {
    parentDir = mkdtempSync(resolve(tmpdir(), 'harness-ws-'));
    originalCwd = process.cwd();
    process.chdir(parentDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(parentDir, { recursive: true, force: true });
  });

  it('genera estructura básica de workspace', async () => {
    await generateWorkspace({
      projectName: 'test-project',
      description: 'Test project',
      packageScope: '@test',
      apps: [{ name: 'api', type: 'nestjs' }],
      libs: [],
      services: [],
    });

    const root = resolve(parentDir, 'test-project');
    expect(fs.existsSync(resolve(root, 'apps'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'libs'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'tools'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'package.json'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'nx.json'))).toBe(true);
  });

  it('genera app NestJS correctamente', async () => {
    await generateWorkspace({
      projectName: 'test-nestjs',
      description: 'NestJS test',
      packageScope: '@test',
      apps: [{ name: 'api', type: 'nestjs' }],
      libs: [],
      services: [],
    });

    const root = resolve(parentDir, 'test-nestjs');
    const apiDir = resolve(root, 'apps/api');
    expect(fs.existsSync(resolve(apiDir, 'project.json'))).toBe(true);
    expect(fs.existsSync(resolve(apiDir, 'src/main.ts'))).toBe(true);
  });

  it('genera docker-compose con servicios', async () => {
    await generateWorkspace({
      projectName: 'test-docker',
      description: 'Docker test',
      packageScope: '@test',
      apps: [{ name: 'api', type: 'nestjs' }],
      libs: [],
      services: ['postgres', 'redis'],
    });

    const root = resolve(parentDir, 'test-docker');
    const composePath = resolve(root, 'docker-compose.yml');
    expect(fs.existsSync(composePath)).toBe(true);

    const content = fs.readFileSync(composePath, 'utf-8');
    expect(content).toContain('postgres');
    expect(content).toContain('redis');
  });

  it('genera SDD siempre', async () => {
    await generateWorkspace({
      projectName: 'test-sdd',
      description: 'SDD test',
      packageScope: '@test',
      apps: [{ name: 'web', type: 'react' }],
      libs: [],
      services: [],
    });

    const root = resolve(parentDir, 'test-sdd');
    expect(fs.existsSync(resolve(root, 'sdd/global.json'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'sdd/schema.json'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'sdd/api.json'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'sdd/components.json'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'sdd/tasks.json'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'sdd/context/constitution.md'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'sdd/context/context_prompt.md'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'AGENTS.md'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'CLAUDE.md'))).toBe(true);
  });

  it('falla si el directorio ya existe', async () => {
    fs.ensureDirSync(resolve(parentDir, 'existing'));

    await expect(
      generateWorkspace({
        projectName: 'existing',
        description: 'Test',
        packageScope: '@test',
        apps: [],
        libs: [],
        services: [],
      }),
    ).rejects.toThrow('ya existe');
  });

  it('genera libs cuando se especifican', async () => {
    await generateWorkspace({
      projectName: 'test-libs',
      description: 'Libs test',
      packageScope: '@test',
      apps: [{ name: 'api', type: 'nestjs' }],
      libs: [{ name: 'shared-types', type: 'shared-types' }],
      services: [],
    });

    const root = resolve(parentDir, 'test-libs');
    expect(fs.existsSync(resolve(root, 'libs/shared-types/project.json'))).toBe(
      true,
    );
  });
});
