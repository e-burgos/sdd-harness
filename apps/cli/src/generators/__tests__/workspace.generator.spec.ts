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

  it('falla si el directorio ya existe con contenido ajeno', async () => {
    fs.ensureDirSync(resolve(parentDir, 'existing'));
    fs.writeJSONSync(resolve(parentDir, 'existing/package.json'), { name: 'other' });

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

// v0.11.0 — bugs del uso real (2026-09-02): init anidaba <name>/<name>/ en un repo ya
// git-inicializado (BUG-1), NestJS no compilaba ni testeaba (BUG-2), apps[].port se
// ignoraba (BUG-3) y sdd.modules no sembraba nada (BUG-4).
describe('workspace.generator v0.11.0', () => {
  let parentDir: string;
  let originalCwd: string;

  beforeEach(() => {
    parentDir = mkdtempSync(resolve(tmpdir(), 'harness-ws11-'));
    originalCwd = process.cwd();
    process.chdir(parentDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(parentDir, { recursive: true, force: true });
  });

  const baseOpts = {
    description: 'Catalog platform',
    packageScope: '@catalog',
    apps: [
      { name: 'catalog-api', type: 'nestjs', port: 3100 },
      { name: 'catalog-web', type: 'react', port: 4300 },
    ],
    libs: [{ name: 'shared-types', type: 'shared-types' }],
    services: ['postgres'],
  };

  it('genera EN el directorio actual cuando targetDir es el cwd, conservando .git, harness.* y el .gitignore previo', async () => {
    const root = resolve(parentDir, 'catalog-platform');
    fs.ensureDirSync(resolve(root, '.git'));
    fs.writeFileSync(resolve(root, '.gitignore'), '# mine\n.secrets\n', 'utf-8');
    fs.writeFileSync(resolve(root, 'harness.idea.md'), '# idea\n', 'utf-8');
    fs.writeJSONSync(resolve(root, 'harness.config.json'), { mode: 'nx' });
    process.chdir(root);

    await generateWorkspace({
      ...baseOpts,
      projectName: 'catalog-platform',
      targetDir: root,
      npmScopes: [{ scope: '@acme', registry: 'https://npm.pkg.github.com' }],
    });

    expect(fs.existsSync(resolve(root, 'catalog-platform'))).toBe(false);
    expect(fs.existsSync(resolve(root, 'nx.json'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'sdd/global.json'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'harness.idea.md'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'harness.config.json'))).toBe(true);
    expect(fs.existsSync(resolve(root, '.git'))).toBe(true);

    const gitignore = fs.readFileSync(resolve(root, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('.secrets');
    expect(gitignore).toContain('node_modules/');
    expect(gitignore).not.toContain('harness.');

    const npmrc = fs.readFileSync(resolve(root, '.npmrc'), 'utf-8');
    expect(npmrc).toContain('@acme:registry=https://npm.pkg.github.com');
    expect(npmrc).toContain('NODE_AUTH_TOKEN');
    expect(npmrc).not.toMatch(/_authToken=/);
  });

  it('copia los archivos de harness idea al workspace cuando se genera en un subdirectorio', async () => {
    fs.writeFileSync(resolve(parentDir, 'harness.idea.md'), '# idea\n', 'utf-8');
    fs.writeJSONSync(resolve(parentDir, 'harness.config.json'), { mode: 'nx' });

    await generateWorkspace({
      ...baseOpts,
      projectName: 'sub-project',
      harnessFiles: [
        resolve(parentDir, 'harness.idea.md'),
        resolve(parentDir, 'harness.config.json'),
      ],
    });

    const root = resolve(parentDir, 'sub-project');
    expect(fs.readFileSync(resolve(root, 'harness.idea.md'), 'utf-8')).toBe('# idea\n');
    expect(fs.existsSync(resolve(root, 'harness.config.json'))).toBe(true);
  });

  it('respeta apps[].port en el código, .env.example y README', async () => {
    await generateWorkspace({ ...baseOpts, projectName: 'ports' });
    const root = resolve(parentDir, 'ports');

    const main = fs.readFileSync(resolve(root, 'apps/catalog-api/src/main.ts'), 'utf-8');
    expect(main).toContain("process.env['CATALOG_API_PORT'] ?? process.env['PORT'] ?? 3100");
    expect(main).not.toContain('|| 3000');

    const vite = fs.readFileSync(resolve(root, 'apps/catalog-web/vite.config.ts'), 'utf-8');
    expect(vite).toContain("process.env['CATALOG_WEB_PORT'] ?? process.env['PORT'] ?? 4300");
    expect(vite).not.toContain('port: 4200');

    const env = fs.readFileSync(resolve(root, '.env.example'), 'utf-8');
    expect(env).toContain('CATALOG_API_PORT=3100');
    expect(env).toContain('CATALOG_WEB_PORT=4300');
    expect(env).toContain('DATABASE_URL=');

    const readme = fs.readFileSync(resolve(root, 'README.md'), 'utf-8');
    expect(readme).toContain('| `apps/catalog-api` | nestjs | 3100 (`CATALOG_API_PORT`) |');
    expect(readme).toContain('nx run-many -t lint test build');
  });

  it('.env.example existe aunque no haya servicios docker', async () => {
    await generateWorkspace({ ...baseOpts, projectName: 'no-services', services: [] });
    const env = fs.readFileSync(resolve(parentDir, 'no-services/.env.example'), 'utf-8');
    expect(env).toContain('CATALOG_API_PORT=3100');
    expect(env).not.toContain('DATABASE_URL');
    expect(fs.existsSync(resolve(parentDir, 'no-services/docker-compose.yml'))).toBe(false);
  });

  it('NestJS: build inferido por @nx/webpack/plugin con webpack.config.js, jest en CommonJS y tsconfig.spec', async () => {
    await generateWorkspace({ ...baseOpts, projectName: 'nest' });
    const root = resolve(parentDir, 'nest');
    const appDir = resolve(root, 'apps/catalog-api');

    const nxJson = fs.readJSONSync(resolve(root, 'nx.json'));
    const webpack = nxJson.plugins.find(
      (p: { plugin: string }) => p.plugin === '@nx/webpack/plugin',
    );
    expect(webpack.options.buildTargetName).toBe('build');
    expect(webpack.options.serveTargetName).not.toBe('serve');

    const project = fs.readJSONSync(resolve(appDir, 'project.json'));
    expect(project.targets.build).toBeUndefined();
    expect(project.targets.test.executor).toBe('@nx/jest:jest');
    expect(project.targets.test.options.jestConfig).toBe('apps/catalog-api/jest.config.js');
    expect(project.targets.serve.options.command).toBe('node dist/apps/catalog-api/main.js');

    const webpackConfig = fs.readFileSync(resolve(appDir, 'webpack.config.js'), 'utf-8');
    expect(webpackConfig).toContain("NxAppWebpackPlugin");
    expect(webpackConfig).toContain("main: './src/main.ts'");
    expect(webpackConfig).toContain("target: 'node'");

    expect(fs.existsSync(resolve(root, 'jest.preset.js'))).toBe(true);
    expect(fs.existsSync(resolve(appDir, 'jest.config.js'))).toBe(true);
    expect(fs.existsSync(resolve(appDir, 'jest.config.ts'))).toBe(false);
    expect(fs.existsSync(resolve(appDir, 'src/app/app.controller.spec.ts'))).toBe(true);

    const spec = fs.readJSONSync(resolve(appDir, 'tsconfig.spec.json'));
    expect(spec.compilerOptions.types).toEqual(['jest', 'node']);
    expect(spec.compilerOptions.emitDecoratorMetadata).toBe(true);
    const tsconfig = fs.readJSONSync(resolve(appDir, 'tsconfig.json'));
    expect(tsconfig.references).toContainEqual({ path: './tsconfig.spec.json' });

    const pkg = fs.readJSONSync(resolve(root, 'package.json'));
    expect(pkg.devDependencies['webpack-cli']).toBeDefined();
    expect(pkg.devDependencies['ts-jest']).toBeDefined();
    expect(pkg.devDependencies['ts-node']).toBeUndefined();
  });

  it('siembra sdd.modules como specs draft registradas en pending_modules', async () => {
    await generateWorkspace({
      ...baseOpts,
      projectName: 'seeded',
      sddAuthor: 'eburgos',
      modules: [
        { name: 'catalog-core', depends_on: [] },
        { name: 'catalog-search', apps: ['apps/catalog-api', 'apps/catalog-web'], depends_on: ['catalog-core'] },
      ],
    });
    const root = resolve(parentDir, 'seeded');
    const global = fs.readJSONSync(resolve(root, 'sdd/global.json'));
    expect(global.pending_modules.map((m: { spec: string }) => m.spec)).toEqual([
      'spec-eburgos-001-catalog-core',
      'spec-eburgos-002-catalog-search',
    ]);
    const index = fs.readJSONSync(resolve(root, 'sdd/specs/index.json'));
    expect(index.specs[1].status).toBe('draft');
    expect(index.specs[1].depends_on).toEqual(['spec-eburgos-001-catalog-core']);
    expect(
      fs.existsSync(resolve(root, 'sdd/specs/spec-eburgos-002-catalog-search/spec-eburgos-002-catalog-search.spec.md')),
    ).toBe(true);
  });

  it('un directorio destino con solo .git y README es aceptable; con package.json ajeno no', async () => {
    const ok = resolve(parentDir, 'fresh');
    fs.ensureDirSync(resolve(ok, '.git'));
    fs.writeFileSync(resolve(ok, 'README.md'), '# fresh\n');
    await expect(
      generateWorkspace({ ...baseOpts, projectName: 'fresh', targetDir: ok }),
    ).resolves.toBeUndefined();
    // el README del repo no se pisa
    expect(fs.readFileSync(resolve(ok, 'README.md'), 'utf-8')).toBe('# fresh\n');

    const busy = resolve(parentDir, 'busy');
    fs.ensureDirSync(busy);
    fs.writeJSONSync(resolve(busy, 'package.json'), { name: 'other' });
    await expect(
      generateWorkspace({ ...baseOpts, projectName: 'busy', targetDir: busy }),
    ).rejects.toThrow(/empty directory/);
  });
});
