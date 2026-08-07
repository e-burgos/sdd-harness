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

    // Kit portable completo
    expect(fs.existsSync(resolve(root, 'sdd/schemas/global.schema.json'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'sdd/scripts/validate-sdd.mjs'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'sdd/scripts/setup-agents.sh'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'sdd/docs/serve.mjs'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'sdd/catalog.json'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'sdd/dual-harness/CLAUDE.md'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'sdd/templates/nx-workspace/nx.json'))).toBe(true);
    expect(fs.existsSync(resolve(root, '.nxignore'))).toBe(true);

    // global.json: forma válida contra el schema estricto y única fuente del nombre
    const globalJson = fs.readJSONSync(resolve(root, 'sdd/global.json'));
    expect(globalJson.project).toBe('test-sdd');
    expect(globalJson.monorepo.apps['web']).toContain('apps/web');
    expect(globalJson.current_cycle).toBeUndefined();
    expect(globalJson.monorepo.tools).toBeUndefined();

    // El kit no hardcodea el nombre del proyecto (regla de portabilidad)
    const constitution = fs.readFileSync(
      resolve(root, 'sdd/context/constitution.md'),
      'utf-8',
    );
    expect(constitution).not.toContain('test-sdd');

    // Contexto del subproyecto creado (exento de la regla de portabilidad)
    expect(
      fs.existsSync(resolve(root, 'sdd/context/apps/web/constitution.md')),
    ).toBe(true);
    expect(
      fs.existsSync(resolve(root, 'sdd/context/apps/web/updates/.gitkeep')),
    ).toBe(true);
  });

  it('genera app react desde el blueprint portable', async () => {
    await generateWorkspace({
      projectName: 'test-react',
      description: 'React test',
      packageScope: '@test',
      apps: [{ name: 'portal', type: 'react' }],
      libs: [],
      services: [],
    });

    const root = resolve(parentDir, 'test-react');
    const appDir = resolve(root, 'apps/portal');
    expect(fs.existsSync(resolve(appDir, 'Dockerfile'))).toBe(true);
    expect(fs.existsSync(resolve(appDir, 'nginx.conf'))).toBe(true);
    expect(fs.existsSync(resolve(appDir, 'src/pages/HomePage.tsx'))).toBe(true);

    const projectJson = fs.readJSONSync(resolve(appDir, 'project.json'));
    expect(projectJson.name).toBe('portal');
    expect(projectJson.targets.build.options.outputPath).toBe('dist/apps/portal');

    const viteConfig = fs.readFileSync(resolve(appDir, 'vite.config.ts'), 'utf-8');
    expect(viteConfig).toContain('dist/apps/portal');
    expect(viteConfig).not.toContain('example-app');
  });

  it('genera app springboot desde el blueprint java-api (Maven, sin Gradle)', async () => {
    await generateWorkspace({
      projectName: 'test-java',
      description: 'Java test',
      packageScope: '@test',
      apps: [{ name: 'orders-api', type: 'springboot' }],
      libs: [],
      services: [],
    });

    const root = resolve(parentDir, 'test-java');
    const appDir = resolve(root, 'apps/orders-api');
    expect(fs.existsSync(resolve(appDir, 'pom.xml'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'settings.gradle'))).toBe(false);
    expect(
      fs.existsSync(
        resolve(
          appDir,
          'src/main/java/com/example/ordersapi/OrdersApiApplication.java',
        ),
      ),
    ).toBe(true);

    const projectJson = fs.readJSONSync(resolve(appDir, 'project.json'));
    expect(projectJson.name).toBe('orders-api');
    expect(projectJson.targets.build.executor).toBe('nx:run-commands');
    expect(projectJson.targets.build.options.cwd).toBe('apps/orders-api');

    const pom = fs.readFileSync(resolve(appDir, 'pom.xml'), 'utf-8');
    expect(pom).toContain('<artifactId>orders-api</artifactId>');
    expect(pom).toContain('com.example.ordersapi.OrdersApiApplication');

    const nxJson = fs.readJSONSync(resolve(root, 'nx.json'));
    const plugins = nxJson.plugins.map((p: { plugin: string }) => p.plugin);
    expect(plugins).not.toContain('@nx/gradle');
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
