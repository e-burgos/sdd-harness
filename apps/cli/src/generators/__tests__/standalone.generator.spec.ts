import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

import { generateStandalone } from '../standalone.generator.js';

vi.mock('../../utils/exec.js', () => ({
  exec: vi.fn(() => ''),
  execSilent: vi.fn(() => ''),
}));

describe('standalone.generator', () => {
  let parentDir: string;
  let originalCwd: string;

  beforeEach(() => {
    parentDir = mkdtempSync(resolve(tmpdir(), 'harness-standalone-'));
    originalCwd = process.cwd();
    process.chdir(parentDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(parentDir, { recursive: true, force: true });
  });

  it('genera app react en la raíz sin Nx, con SDD y registro standalone', async () => {
    await generateStandalone({
      projectName: 'my-portal',
      description: 'Standalone react test',
      appType: 'react',
      services: [],
    });

    const root = resolve(parentDir, 'my-portal');

    // App en la raíz, sin artefactos Nx
    expect(fs.existsSync(resolve(root, 'src/main.tsx'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'vite.config.ts'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'index.html'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'project.json'))).toBe(false);
    expect(fs.existsSync(resolve(root, 'nx.json'))).toBe(false);
    expect(fs.existsSync(resolve(root, '.nxignore'))).toBe(false);
    expect(fs.existsSync(resolve(root, 'apps'))).toBe(false);

    const viteConfig = fs.readFileSync(resolve(root, 'vite.config.ts'), 'utf-8');
    expect(viteConfig).not.toContain('example-app');
    expect(viteConfig).not.toContain('../../dist');

    // SDD instalado con registro de app lógica única
    const globalJson = fs.readJSONSync(resolve(root, 'sdd/global.json'));
    expect(globalJson.project).toBe('my-portal');
    expect(globalJson.monorepo.tool).toContain('none');
    expect(globalJson.monorepo.apps['my-portal']).toContain('standalone');

    const constitution = fs.readFileSync(
      resolve(root, 'sdd/context/apps/my-portal/constitution.md'),
      'utf-8',
    );
    expect(constitution).toContain('raíz del repositorio');

    // package.json: scripts de la app + arnés SDD + ajv
    const pkg = fs.readJSONSync(resolve(root, 'package.json'));
    expect(pkg.scripts['dev']).toBe('vite');
    expect(pkg.scripts['sdd:validate']).toBe('node sdd/scripts/validate-sdd.mjs');
    expect(pkg.scripts['setup:agents']).toBeDefined();
    expect(pkg.devDependencies['ajv']).toBeDefined();
    expect(pkg.devDependencies['ajv-formats']).toBeDefined();
  });

  it('genera app springboot en la raíz con pom renombrado y scripts mvn', async () => {
    await generateStandalone({
      projectName: 'orders-api',
      description: 'Standalone java test',
      appType: 'springboot',
      services: [],
    });

    const root = resolve(parentDir, 'orders-api');

    expect(fs.existsSync(resolve(root, 'pom.xml'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'checkstyle.xml'))).toBe(true);
    expect(fs.existsSync(resolve(root, 'project.json'))).toBe(false);
    expect(
      fs.existsSync(
        resolve(root, 'src/main/java/com/example/ordersapi/OrdersApiApplication.java'),
      ),
    ).toBe(true);

    const pom = fs.readFileSync(resolve(root, 'pom.xml'), 'utf-8');
    expect(pom).toContain('<artifactId>orders-api</artifactId>');
    expect(pom).not.toContain('example-api');

    const pkg = fs.readJSONSync(resolve(root, 'package.json'));
    expect(pkg.scripts['build']).toContain('mvn');
    expect(pkg.scripts['sdd:validate']).toBeDefined();

    const gitignore = fs.readFileSync(resolve(root, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('target/');
  });

  it('genera fastify, hono, nestjs, nextjs y python en la raíz', async () => {
    const cases: Array<[string, string]> = [
      ['api-fastify', 'fastify'],
      ['api-hono', 'hono'],
      ['api-nest', 'nestjs'],
      ['web-next', 'nextjs'],
      ['agent-py', 'python'],
    ];

    for (const [name, type] of cases) {
      await generateStandalone({
        projectName: name,
        description: `Standalone ${type} test`,
        appType: type,
        services: [],
      });

      const root = resolve(parentDir, name);
      expect(fs.existsSync(resolve(root, 'package.json'))).toBe(true);
      expect(fs.existsSync(resolve(root, 'sdd/global.json'))).toBe(true);
      expect(fs.existsSync(resolve(root, 'nx.json'))).toBe(false);

      const pkg = fs.readJSONSync(resolve(root, 'package.json'));
      expect(pkg.scripts['sdd:validate']).toBeDefined();
    }

    expect(
      fs.existsSync(resolve(parentDir, 'api-nest/nest-cli.json')),
    ).toBe(true);
    expect(
      fs.existsSync(resolve(parentDir, 'web-next/app/page.tsx')),
    ).toBe(true);
    expect(
      fs.existsSync(resolve(parentDir, 'agent-py/pyproject.toml')),
    ).toBe(true);
    expect(
      fs.existsSync(resolve(parentDir, 'api-hono/src/main.ts')),
    ).toBe(true);
    expect(
      fs.existsSync(resolve(parentDir, 'api-fastify/src/main.ts')),
    ).toBe(true);
  });

  it('falla si el directorio ya existe', async () => {
    fs.ensureDirSync(resolve(parentDir, 'existing'));

    await expect(
      generateStandalone({
        projectName: 'existing',
        description: 'Test',
        appType: 'react',
        services: [],
      }),
    ).rejects.toThrow('ya existe');
  });
});
