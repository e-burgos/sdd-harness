import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

import { generateApp, resolveAppPort, type AppSpec } from '../app.generator.js';
import { generateLib } from '../lib.generator.js';
import { generateStandalone } from '../standalone.generator.js';
import { generateWorkspace } from '../workspace.generator.js';
import { addAppTypeDepsToRootPkg } from '../root-package.js';
import { FRONTEND_VERSIONS } from '../versions.js';
import { HarnessConfigSchema } from '../../config/schema.js';

vi.mock('../../utils/exec.js', () => ({
  exec: vi.fn(() => ''),
  execSilent: vi.fn(() => ''),
}));

const read = (root: string, rel: string) => fs.readFileSync(resolve(root, rel), 'utf-8');

describe('frontend-apps generators', () => {
  let root: string;
  let originalCwd: string;

  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), 'harness-fe-'));
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  });

  describe('next-bff', () => {
    it('renders a Next app with tucu-ui, an upstream route, its test and a test target', async () => {
      await generateApp(root, { name: 'catalog-bff', type: 'next-bff' }, '@t');
      const app = 'apps/catalog-bff';

      expect(read(root, `${app}/app/layout.tsx`)).toContain('NextThemeProvider');
      expect(read(root, `${app}/app/page.tsx`)).toContain('CATALOG_BFF_UPSTREAM_URL');
      expect(read(root, `${app}/app/upstream-health.tsx`)).toContain("fetch('/api/health')");

      const upstream = read(root, `${app}/lib/upstream.ts`);
      expect(upstream).toContain("process.env['CATALOG_BFF_UPSTREAM_URL']");
      expect(upstream).toContain('http://localhost:3000/api/v1');

      const route = read(root, `${app}/app/api/health/route.ts`);
      expect(route).toContain("upstreamUrl('/health')");
      expect(route).toContain("from '../../../lib/types'");
      expect(read(root, `${app}/lib/types.ts`)).toContain('UpstreamHealth');

      const routeTest = read(root, `${app}/app/api/health/route.test.ts`);
      expect(routeTest).toContain("process.env['CATALOG_BFF_UPSTREAM_URL']");
      expect(routeTest).toContain('502');
      expect(read(root, `${app}/vitest.config.ts`)).toContain("environment: 'node'");

      const project = fs.readJSONSync(resolve(root, `${app}/project.json`));
      expect(project.targets.test.options.command).toContain('vitest run');
      expect(project.targets.test.options.cwd).toBe(app);
      expect(project.targets.serve.options.port).toBe(3001);
    });

    it('imports the type from the shared-types lib when the workspace has one', async () => {
      await generateLib(root, { name: 'shared-types', type: 'shared-types' }, '@t');
      await generateApp(root, { name: 'bff', type: 'next-bff' }, '@t');

      expect(read(root, 'apps/bff/app/api/health/route.ts')).toContain("from '@shared-types'");
      expect(read(root, 'apps/bff/app/upstream-health.tsx')).toContain("from '@shared-types'");
      expect(fs.existsSync(resolve(root, 'apps/bff/lib/types.ts'))).toBe(false);
      expect(read(root, 'libs/shared-types/src/lib/upstream-health.ts')).toContain('UpstreamHealth');
      expect(read(root, 'libs/shared-types/src/index.ts')).toContain(
        "export * from './lib/upstream-health';",
      );
    });

    it('tucuUi=false keeps the route and drops tucu-ui from the page', async () => {
      await generateApp(root, { name: 'bff', type: 'next-bff', tucuUi: false }, '@t');
      expect(read(root, 'apps/bff/app/page.tsx')).not.toContain('tucu-ui');
      expect(fs.existsSync(resolve(root, 'apps/bff/app/api/health/route.ts'))).toBe(true);
      expect(fs.existsSync(resolve(root, 'apps/bff/app/globals.css'))).toBe(false);
    });

    it('adds next, tucu-ui and the vitest toolchain to the root package.json', () => {
      const pkg = { scripts: {}, dependencies: {}, devDependencies: {} } as Parameters<
        typeof addAppTypeDepsToRootPkg
      >[0];
      addAppTypeDepsToRootPkg(pkg, 'next-bff');
      expect(pkg.dependencies['next']).toBe(FRONTEND_VERSIONS.next);
      expect(pkg.dependencies['@e-burgos/tucu-ui']).toBe(FRONTEND_VERSIONS['@e-burgos/tucu-ui']);
      expect(pkg.devDependencies['vitest']).toBe(FRONTEND_VERSIONS.vitest);
      expect(pkg.devDependencies['vite']).toBe(FRONTEND_VERSIONS.vite);
    });
  });

  describe('mfe and mfe-shell', () => {
    const apps: AppSpec[] = [
      { name: 'shell', type: 'mfe-shell' },
      { name: 'cart', type: 'mfe', shell: 'shell' },
      { name: 'orders-ui', type: 'mfe', shell: 'shell', port: 5100 },
      { name: 'other-shell', type: 'mfe-shell' },
      { name: 'stray', type: 'mfe', shell: 'other-shell' },
    ];

    const generate = async (name: string, list: AppSpec[] = apps) => {
      await generateApp(root, list.find((a) => a.name === name)!, '@t', { apps: list });
    };

    it('mfe sets base to /<name>/ and uses the tucu-ui mfe provider', async () => {
      await generate('cart');
      expect(read(root, 'apps/cart/vite.config.ts')).toContain("base: '/cart/',");
      const app = read(root, 'apps/cart/src/app/app.tsx');
      expect(app).toContain('architecturalPatterns="mfe"');
      expect(app).toContain("const basePath = '/cart';");
      expect(read(root, 'apps/cart/src/index.css')).toContain('@e-burgos/tucu-ui/theme');
    });

    it('mfe with tucuUi=false only changes the base path', async () => {
      await generateApp(root, { name: 'cart', type: 'mfe', tucuUi: false }, '@t');
      expect(read(root, 'apps/cart/vite.config.ts')).toContain("base: '/cart/',");
      expect(read(root, 'apps/cart/src/app/app.tsx')).toContain('BrowserRouter');
    });

    it('staggers default mfe ports and respects explicit ones', () => {
      expect(resolveAppPort(apps[0], apps)).toBe(4300);
      expect(resolveAppPort(apps[1], apps)).toBe(4301);
      expect(resolveAppPort(apps[2], apps)).toBe(5100);
      expect(resolveAppPort(apps[4], apps)).toBe(4303);
    });

    it('resolves unique default ports and lets explicit ports win', () => {
      const mono: AppSpec[] = [
        { name: 'core-api', type: 'nestjs', port: 3000 },
        { name: 'web', type: 'react' },
        { name: 'site', type: 'nextjs', port: 3100 },
        { name: 'portal-bff', type: 'next-bff' },
        { name: 'portal', type: 'mfe-shell' },
        { name: 'billing', type: 'mfe' },
        { name: 'reports', type: 'mfe' },
        { name: 'agent-api', type: 'python' },
        { name: 'other-api', type: 'fastify' },
      ];
      const ports = mono.map((app) => resolveAppPort(app, mono));
      expect(new Set(ports).size).toBe(mono.length);
      expect(resolveAppPort(mono[1], mono)).toBe(4200);
      expect(resolveAppPort(mono[4], mono)).toBe(4300);
      expect(resolveAppPort(mono[5], mono)).toBe(4301);
      expect(resolveAppPort(mono[6], mono)).toBe(4302);
      expect(resolveAppPort(mono[0], mono)).toBe(3000);
      expect(resolveAppPort(mono[8], mono)).toBe(3002);
    });

    it('shell proxies /<mfe>/ only for the mfes that declare it as their shell', async () => {
      await generate('shell');
      const vite = read(root, 'apps/shell/vite.config.ts');
      expect(vite).toContain("'/cart/': {");
      expect(vite).toContain("process.env['CART_PORT'] ?? 4301");
      expect(vite).toContain("'/orders-ui/': {");
      expect(vite).toContain("process.env['ORDERS_UI_PORT'] ?? 5100");
      expect(vite).not.toContain('/stray/');
      expect(vite).toContain("host: 'localhost', proxy: mfeProxy");
      expect(vite).toContain("process.env['SHELL_PORT']");
    });

    it('shell menu links to each mfe path', async () => {
      await generate('shell');
      const app = read(root, 'apps/shell/src/app/app.tsx');
      expect(app).toContain('"name": "cart"');
      expect(app).toContain('"name": "orders-ui"');
      expect(app).not.toContain('stray');
      expect(app).toContain('href: `/${mfe.name}/`');
      expect(fs.existsSync(resolve(root, 'apps/shell/src/pages/MfeRedirect.tsx'))).toBe(true);
    });

    it('shell nginx.conf routes /<mfe>/ to each static build and the README documents it', async () => {
      await generate('shell');
      const nginx = read(root, 'apps/shell/nginx.conf');
      expect(nginx).toContain('location /cart/ {');
      expect(nginx).toContain('try_files $uri $uri/ /cart/index.html;');
      expect(nginx).toContain('location /orders-ui/ {');
      expect(nginx).not.toContain('/stray/');
      expect(nginx).toContain('location / {');

      const dockerfile = read(root, 'apps/shell/Dockerfile');
      expect(dockerfile).toContain('-p shell,cart,orders-ui');
      expect(dockerfile).toContain('/usr/share/nginx/html/cart');

      const readme = read(root, 'apps/shell/README.md');
      expect(readme).toContain('`/cart/`');
      expect(readme).toContain('server.proxy');
    });

    it('a shell without mfes keeps an empty proxy', async () => {
      await generateApp(root, { name: 'solo-shell', type: 'mfe-shell' }, '@t');
      expect(read(root, 'apps/solo-shell/vite.config.ts')).toContain('const mfeProxy = {\n};');
    });

    it('mfe-shell with tucuUi=false renders plain links', async () => {
      const list: AppSpec[] = [
        { name: 'shell', type: 'mfe-shell', tucuUi: false },
        { name: 'cart', type: 'mfe' },
      ];
      await generate('shell', list);
      const app = read(root, 'apps/shell/src/app/app.tsx');
      expect(app).toContain('["cart"]');
      expect(app).not.toContain('tucu-ui');
    });

    it('adds the react family and tucu-ui to the root package.json', () => {
      for (const type of ['mfe', 'mfe-shell']) {
        const pkg = { scripts: {}, dependencies: {}, devDependencies: {} } as Parameters<
          typeof addAppTypeDepsToRootPkg
        >[0];
        addAppTypeDepsToRootPkg(pkg, type);
        expect(pkg.dependencies['react']).toBe(FRONTEND_VERSIONS.react);
        expect(pkg.dependencies['@e-burgos/tucu-ui']).toBeDefined();
        expect(pkg.devDependencies['vite']).toBe(FRONTEND_VERSIONS.vite);
      }
    });
  });

  describe('validation', () => {
    const base = {
      project: { name: 'p', description: 'd', packageScope: '@p' },
    };

    it('rejects workspace-only types in standalone mode (config)', () => {
      for (const type of ['next-bff', 'mfe-shell', 'mfe']) {
        const result = HarnessConfigSchema.safeParse({
          ...base,
          mode: 'standalone',
          apps: [{ name: 'web', type }],
        });
        expect(result.success).toBe(false);
        expect(JSON.stringify(result.error?.issues)).toContain('only supported in monorepo');
      }
    });

    it('generateStandalone rejects workspace-only types with a clear error', async () => {
      process.chdir(root);
      await expect(
        generateStandalone({
          projectName: 'sa',
          description: 'd',
          appType: 'mfe',
          services: [],
        }),
      ).rejects.toThrow(/only supported in monorepo/);
    });

    it('an mfe pointing at a missing shell is a config error', () => {
      const result = HarnessConfigSchema.safeParse({
        ...base,
        apps: [
          { name: 'shell', type: 'mfe-shell' },
          { name: 'cart', type: 'mfe', shell: 'ghost' },
        ],
      });
      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).toContain('shell \\"ghost\\" does not exist');
    });

    it('an mfe whose shell is not an mfe-shell is a config error', () => {
      const result = HarnessConfigSchema.safeParse({
        ...base,
        apps: [
          { name: 'web', type: 'nextjs' },
          { name: 'cart', type: 'mfe', shell: 'web' },
        ],
      });
      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).toContain('must be an app of type');
    });

    it('an mfe without shell needs exactly one mfe-shell', () => {
      const none = HarnessConfigSchema.safeParse({
        ...base,
        apps: [{ name: 'cart', type: 'mfe' }],
      });
      expect(none.success).toBe(false);

      const many = HarnessConfigSchema.safeParse({
        ...base,
        apps: [
          { name: 'a', type: 'mfe-shell' },
          { name: 'b', type: 'mfe-shell' },
          { name: 'cart', type: 'mfe' },
        ],
      });
      expect(many.success).toBe(false);

      const one = HarnessConfigSchema.safeParse({
        ...base,
        apps: [
          { name: 'a', type: 'mfe-shell' },
          { name: 'cart', type: 'mfe' },
        ],
      });
      expect(one.success).toBe(true);
    });

    it('generateWorkspace rejects a missing shell before writing anything', async () => {
      process.chdir(root);
      await expect(
        generateWorkspace({
          projectName: 'ws',
          description: 'd',
          packageScope: '@ws',
          apps: [{ name: 'cart', type: 'mfe', shell: 'ghost' }],
          libs: [],
          services: [],
        }),
      ).rejects.toThrow(/does not exist/);
      expect(fs.existsSync(resolve(root, 'ws'))).toBe(false);
    });

    it('generateWorkspace builds shell, mfes and next-bff together from config-shaped input', async () => {
      process.chdir(root);
      await generateWorkspace({
        projectName: 'full',
        description: 'd',
        packageScope: '@full',
        apps: [
          { name: 'shell', type: 'mfe-shell' },
          { name: 'cart', type: 'mfe' },
          { name: 'bff', type: 'next-bff' },
        ],
        libs: [{ name: 'shared-types', type: 'shared-types' }],
        services: [],
        skipVerify: true,
      });
      const ws = resolve(root, 'full');
      expect(read(ws, 'apps/shell/vite.config.ts')).toContain("'/cart/'");
      expect(read(ws, 'apps/cart/vite.config.ts')).toContain("base: '/cart/',");
      expect(read(ws, 'apps/bff/app/api/health/route.ts')).toContain("'@shared-types'");
      const pkg = fs.readJSONSync(resolve(ws, 'package.json'));
      expect(pkg.dependencies['next']).toBe(FRONTEND_VERSIONS.next);
      expect(pkg.devDependencies['vitest']).toBe(FRONTEND_VERSIONS.vitest);
      const nx = fs.readJSONSync(resolve(ws, 'nx.json'));
      const plugins = nx.plugins.map((p: string | { plugin: string }) =>
        typeof p === 'string' ? p : p.plugin,
      );
      expect(plugins).toContain('@nx/vite');
      expect(plugins).toContain('@nx/next/plugin');
      expect(read(ws, '.env.example')).toContain('CART_PORT=4301');
    });
  });
});
