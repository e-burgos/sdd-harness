import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

import { generateStandalone } from '../standalone.generator.js';
import { FRONTEND_VERSIONS } from '../versions.js';

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
    expect(pkg.scripts['sdd:tucu']).toBe('node sdd/scripts/sdd-tucu.mjs');
    expect(pkg.scripts['setup:agents']).toBeDefined();
    expect(pkg.devDependencies['ajv']).toBeDefined();
    expect(pkg.devDependencies['ajv-formats']).toBeDefined();
  });

  it('react standalone: tucu-ui por defecto con pins de versions.ts', async () => {
    await generateStandalone({
      projectName: 'tucu-portal',
      description: 'Standalone react tucu-ui',
      appType: 'react',
      services: [],
    });
    const root = resolve(parentDir, 'tucu-portal');

    const pkg = fs.readJSONSync(resolve(root, 'package.json'));
    expect(pkg.dependencies['@e-burgos/tucu-ui']).toBe(FRONTEND_VERSIONS['@e-burgos/tucu-ui']);
    expect(pkg.dependencies['react']).toBe(FRONTEND_VERSIONS.react);
    expect(pkg.devDependencies['vite']).toBe(FRONTEND_VERSIONS.vite);
    expect(pkg.devDependencies['vitest']).toBe(FRONTEND_VERSIONS.vitest);
    expect(pkg.devDependencies['tailwindcss']).toBe(FRONTEND_VERSIONS.tailwindcss);

    const css = fs.readFileSync(resolve(root, 'src/index.css'), 'utf-8');
    expect(css).toContain("@import '@e-burgos/tucu-ui/theme';");
    expect(css).toContain("@source '../node_modules/@e-burgos/tucu-ui/**/*.mjs';");
    expect(fs.readFileSync(resolve(root, 'src/app/app.tsx'), 'utf-8')).toContain('ThemeProvider');
  });

  it('react standalone con tucuUi=false queda plano', async () => {
    await generateStandalone({
      projectName: 'plain-portal',
      description: 'Standalone react plano',
      appType: 'react',
      tucuUi: false,
      services: [],
    });
    const root = resolve(parentDir, 'plain-portal');

    const pkg = fs.readJSONSync(resolve(root, 'package.json'));
    expect(pkg.dependencies).not.toHaveProperty('@e-burgos/tucu-ui');
    expect(fs.readFileSync(resolve(root, 'src/index.css'), 'utf-8')).toBe("@import 'tailwindcss';\n");
    expect(fs.readFileSync(resolve(root, 'src/app/app.tsx'), 'utf-8')).toContain('BrowserRouter');
  });

  it('nextjs standalone: Next 16 con tucu-ui por defecto y plano con tucuUi=false', async () => {
    await generateStandalone({
      projectName: 'tucu-next',
      description: 'Standalone next tucu-ui',
      appType: 'nextjs',
      services: [],
    });
    const root = resolve(parentDir, 'tucu-next');
    const pkg = fs.readJSONSync(resolve(root, 'package.json'));
    expect(pkg.dependencies['next']).toBe(FRONTEND_VERSIONS.next);
    expect(pkg.dependencies['@e-burgos/tucu-ui']).toBe(FRONTEND_VERSIONS['@e-burgos/tucu-ui']);
    expect(pkg.devDependencies['@tailwindcss/postcss']).toBe(FRONTEND_VERSIONS['@tailwindcss/postcss']);
    expect(pkg.devDependencies['tailwindcss']).toBe(FRONTEND_VERSIONS.tailwindcss);
    expect(fs.readFileSync(resolve(root, 'app/layout.tsx'), 'utf-8')).toContain('NextThemeProvider');
    expect(fs.readFileSync(resolve(root, 'app/globals.css'), 'utf-8')).toContain(
      "@source '../node_modules/@e-burgos/tucu-ui/**/*.mjs';",
    );
    expect(fs.existsSync(resolve(root, 'postcss.config.mjs'))).toBe(true);

    await generateStandalone({
      projectName: 'plain-next',
      description: 'Standalone next plano',
      appType: 'nextjs',
      tucuUi: false,
      services: [],
    });
    const plain = resolve(parentDir, 'plain-next');
    const plainPkg = fs.readJSONSync(resolve(plain, 'package.json'));
    expect(plainPkg.dependencies['next']).toBe(FRONTEND_VERSIONS.next);
    expect(plainPkg.dependencies).not.toHaveProperty('@e-burgos/tucu-ui');
    expect(fs.existsSync(resolve(plain, 'postcss.config.mjs'))).toBe(false);
    expect(fs.readFileSync(resolve(plain, 'app/layout.tsx'), 'utf-8')).not.toContain('tucu-ui');
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

  it('falla si el directorio ya existe con contenido ajeno', async () => {
    fs.ensureDirSync(resolve(parentDir, 'existing'));
    fs.writeFileSync(resolve(parentDir, 'existing/index.ts'), 'export {};\n');

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
