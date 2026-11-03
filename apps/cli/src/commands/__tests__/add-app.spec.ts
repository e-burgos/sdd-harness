import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';
import { addAppCommand, pinImplicitShells, topologyErrorsForNewApp, ADD_APP_TYPE_OPTIONS } from '../add/app.js';
import { generateApp, type AppSpec } from '../../generators/app.generator.js';
import { appendAppToEnvExample } from '../../generators/docker.generator.js';
import { appUsesTucuUi, resolveKitTucuUiFlag, hasConflictingTucuUiFlags } from '../../utils/tucu-ui-offer.js';

vi.mock('../../utils/exec.js', () => ({
  exec: vi.fn(() => ''),
  execSilent: vi.fn(() => ''),
}));

type Runner = (ctx: { args: Record<string, unknown>; rawArgs: string[] }) => Promise<void>;
const run = addAppCommand.run as unknown as Runner;

describe('harness add app: new app types', () => {
  let ws: string;
  let originalCwd: string;

  const read = (rel: string) => fs.readFileSync(resolve(ws, rel), 'utf-8');

  beforeEach(() => {
    ws = mkdtempSync(resolve(tmpdir(), 'harness-add-app-'));
    originalCwd = process.cwd();
    fs.outputJSONSync(resolve(ws, 'package.json'), {
      name: '@acme/repo',
      scripts: {},
      dependencies: {},
      devDependencies: {},
    });
    fs.outputJSONSync(resolve(ws, 'sdd/global.json'), { monorepo: { apps: {} } });
    process.chdir(ws);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    rmSync(ws, { recursive: true, force: true });
  });

  it('offers every app type, including the new ones', () => {
    const values = ADD_APP_TYPE_OPTIONS.map((o) => o.value);
    expect(values).toEqual(
      expect.arrayContaining(['next-bff', 'mfe-shell', 'mfe', 'python']),
    );
  });

  it('adding an mfe to an existing shell patches the shell and registers the shell link', async () => {
    await run({ args: { type: 'mfe-shell', name: 'portal', 'tucu-ui': false }, rawArgs: ['--no-tucu-ui'] });
    expect(read('apps/portal/nginx.conf')).not.toContain('/orders/');

    await run({ args: { type: 'mfe', name: 'orders', 'tucu-ui': false }, rawArgs: ['--no-tucu-ui'] });

    expect(read('apps/portal/nginx.conf')).toContain('location /orders/');
    expect(read('apps/portal/Dockerfile')).toContain('-p portal,orders');
    expect(read('apps/orders/vite.config.ts')).toContain("base: '/orders/'");
    expect(fs.readJSONSync(resolve(ws, 'sdd/global.json')).monorepo.apps.orders).toBe(
      'apps/orders — mfe (shell: portal)',
    );

    await run({ args: { type: 'mfe', name: 'billing', 'tucu-ui': false }, rawArgs: ['--no-tucu-ui'] });
    const nginx = read('apps/portal/nginx.conf');
    expect(nginx).toContain('location /orders/');
    expect(nginx).toContain('location /billing/');
    expect(nginx.match(/location \/orders\/ \{/g)).toHaveLength(1);
  });

  it('adding a shell after its mfes picks the existing mfes up', async () => {
    fs.outputJSONSync(resolve(ws, 'sdd/global.json'), {
      monorepo: { apps: { orders: 'apps/orders — mfe', billing: 'apps/billing — mfe' } },
    });
    await run({ args: { type: 'mfe-shell', name: 'portal', 'tucu-ui': false }, rawArgs: ['--no-tucu-ui'] });
    const nginx = read('apps/portal/nginx.conf');
    expect(nginx).toContain('location /orders/');
    expect(nginx).toContain('location /billing/');
  });

  it('an mfe without any shell is rejected before generating', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    await expect(
      run({ args: { type: 'mfe', name: 'orders', 'tucu-ui': false }, rawArgs: [] }),
    ).rejects.toThrow('exit:1');
    expect(exit).toHaveBeenCalledWith(1);
    expect(fs.pathExistsSync(resolve(ws, 'apps/orders'))).toBe(false);
  });

  it('registers a stack description for the new types in the subproject context', async () => {
    await run({ args: { type: 'next-bff', name: 'catalog-bff', 'tucu-ui': false }, rawArgs: [] });
    expect(read('sdd/context/apps/catalog-bff/constitution.md')).toContain('Next.js App Router BFF');
    expect(read('sdd/context/apps/catalog-bff/context_prompt.md')).toContain('**Stack:**');
  });

  it('--ml adds TensorFlow to a python app', async () => {
    await run({ args: { type: 'python', name: 'agent', ml: true }, rawArgs: ['--ml'] });
    expect(read('apps/agent/pyproject.toml')).toMatch(/langgraph[^\n]*\n\s+"tensorflow/);
  });

  it('--shell and --ml are rejected on other types', async () => {
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    await expect(
      run({ args: { type: 'react', name: 'web', shell: 'portal', 'tucu-ui': false }, rawArgs: [] }),
    ).rejects.toThrow('exit:1');
    await expect(
      run({ args: { type: 'react', name: 'web', ml: true, 'tucu-ui': false }, rawArgs: [] }),
    ).rejects.toThrow('exit:1');
  });

  const addApp = (type: string, name: string, extra: Record<string, unknown> = {}) =>
    run({ args: { type, name, 'tucu-ui': false, ...extra }, rawArgs: ['--no-tucu-ui'] });
  const registry = () => fs.readJSONSync(resolve(ws, 'sdd/global.json')).monorepo.apps;

  it('shells first, then mfes: each mfe lands in its own shell and keeps its registry link', async () => {
    await addApp('mfe-shell', 'portal');
    await addApp('mfe-shell', 'admin');
    await addApp('mfe', 'orders', { shell: 'portal' });
    await addApp('mfe', 'ops', { shell: 'admin' });
    await addApp('mfe', 'billing', { shell: 'portal' });

    expect(registry().orders).toBe('apps/orders — mfe (shell: portal)');
    expect(registry().ops).toBe('apps/ops — mfe (shell: admin)');
    expect(read('apps/portal/nginx.conf')).toContain('location /orders/');
    expect(read('apps/portal/nginx.conf')).toContain('location /billing/');
    expect(read('apps/portal/nginx.conf')).not.toContain('/ops/');
    expect(read('apps/admin/nginx.conf')).toContain('location /ops/');
    expect(read('apps/admin/nginx.conf')).not.toContain('/orders/');
  });

  it('mfes first, then two shells: the second shell does not steal or drop the first shell mfes', async () => {
    fs.outputJSONSync(resolve(ws, 'sdd/global.json'), {
      monorepo: { apps: { orders: 'apps/orders — mfe', billing: 'apps/billing — mfe' } },
    });
    await addApp('mfe-shell', 'portal');
    await addApp('mfe-shell', 'admin');

    expect(registry().orders).toBe('apps/orders — mfe (shell: portal)');
    expect(registry().billing).toBe('apps/billing — mfe (shell: portal)');
    expect(read('apps/portal/nginx.conf')).toContain('location /orders/');
    expect(read('apps/portal/nginx.conf')).toContain('location /billing/');
    expect(read('apps/admin/nginx.conf')).not.toContain('/orders/');
  });

  it('a second shell added later pins the implicit mfes to the previous shell in the registry', async () => {
    await addApp('mfe-shell', 'portal');
    fs.outputJSONSync(resolve(ws, 'sdd/global.json'), {
      monorepo: { apps: { portal: 'apps/portal — mfe-shell', orders: 'apps/orders — mfe' } },
    });
    await addApp('mfe-shell', 'admin');

    expect(registry().orders).toBe('apps/orders — mfe (shell: portal)');
    expect(registry().admin).toBe('apps/admin — mfe-shell');
  });

  it('rejects an addition whose topology errors are new', async () => {
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    fs.outputJSONSync(resolve(ws, 'sdd/global.json'), {
      monorepo: {
        apps: {
          portal: 'apps/portal — mfe-shell',
          admin: 'apps/admin — mfe-shell',
          orders: 'apps/orders — mfe (shell: ghost)',
        },
      },
    });
    await expect(addApp('mfe', 'billing', { shell: 'nowhere' })).rejects.toThrow('exit:1');
    expect(fs.pathExistsSync(resolve(ws, 'apps/billing'))).toBe(false);
  });

  it('keeps the explicit port of an existing mfe when a new mfe is added', async () => {
    const shell: AppSpec = { name: 'portal', type: 'mfe-shell', tucuUi: false };
    const billing: AppSpec = { name: 'billing', type: 'mfe', port: 5001, tucuUi: false };
    const apps = [shell, billing];
    await generateApp(ws, shell, '@acme', { apps });
    await generateApp(ws, billing, '@acme', { apps });
    fs.outputJSONSync(resolve(ws, 'sdd/global.json'), {
      monorepo: {
        apps: { portal: 'apps/portal — mfe-shell', billing: 'apps/billing — mfe (shell: portal)' },
      },
    });

    await addApp('mfe', 'audit');

    const vite = read('apps/portal/vite.config.ts');
    expect(vite).toContain("BILLING_PORT'] ?? 5001");
    expect(vite).toContain("AUDIT_PORT'] ?? 4301");
    expect(read('apps/audit/vite.config.ts')).toContain('?? 4301)');
  });

  it('appends the new app variables to .env.example, once', async () => {
    fs.writeFileSync(resolve(ws, '.env.example'), '# Generated\n\nJWT_SECRET=x\n');
    await addApp('next-bff', 'catalog-bff');
    await addApp('python', 'agent');
    await addApp('nestjs', 'core-api');
    const env = read('.env.example');
    expect(env).toContain('CATALOG_BFF_PORT=3001');
    expect(env).toContain('CATALOG_BFF_UPSTREAM_URL=http://localhost:3000/api/v1');
    expect(env).toContain('AGENT_PORT=8000');
    expect(env).toContain('AGENT_HOST=127.0.0.1');
    expect(env).toContain('CORE_API_PORT=3000');
    expect(env).toContain('JWT_SECRET=x');

    await appendAppToEnvExample(ws, { name: 'agent', type: 'python' }, [{ name: 'agent', type: 'python' }]);
    expect(read('.env.example').match(/AGENT_PORT=/g)).toHaveLength(1);
  });

  it('does not touch a missing .env.example', async () => {
    await addApp('nestjs', 'core-api');
    expect(fs.pathExistsSync(resolve(ws, '.env.example'))).toBe(false);
  });
});

describe('topologyErrorsForNewApp', () => {
  it('flags an mfe pointing at a missing or non-shell app, ignoring problems that were already there', () => {
    const existing = [
      { name: 'web', type: 'react' },
      { name: 'stray', type: 'mfe' },
    ];
    expect(topologyErrorsForNewApp(existing, { name: 'orders', type: 'mfe', shell: 'ghost' })).toHaveLength(1);
    expect(topologyErrorsForNewApp(existing, { name: 'orders', type: 'mfe', shell: 'web' })[0]).toContain('mfe-shell');
    expect(topologyErrorsForNewApp([], { name: 'portal', type: 'mfe-shell' })).toEqual([]);
  });

  it('reports errors introduced by the addition even when they quote another app', () => {
    const existing = [
      { name: 'portal', type: 'mfe-shell' },
      { name: 'admin', type: 'mfe-shell' },
      { name: 'orders', type: 'mfe', shell: 'portal' },
    ];
    const withDangling = [...existing, { name: 'loose', type: 'mfe', shell: 'portal' }];
    expect(topologyErrorsForNewApp(withDangling, { name: 'extra', type: 'mfe-shell' })).toEqual([]);

    const ambiguousBefore = [
      { name: 'portal', type: 'mfe-shell' },
      { name: 'orders', type: 'mfe' },
    ];
    expect(topologyErrorsForNewApp(ambiguousBefore, { name: 'admin', type: 'mfe-shell' })).toEqual([]);
    expect(pinImplicitShells(ambiguousBefore, { name: 'admin', type: 'mfe-shell' })[1].shell).toBe('portal');
  });

  it('fails on errors introduced for other apps when the shell count changes the resolution', () => {
    const existing = [
      { name: 'portal', type: 'mfe-shell' },
      { name: 'admin', type: 'mfe-shell' },
      { name: 'orders', type: 'mfe' },
    ];
    const errors = topologyErrorsForNewApp(existing, { name: 'third', type: 'mfe-shell' });
    expect(errors.some((error) => error.includes('"orders"'))).toBe(true);
  });

  it('rejects ml and tucuUi on types that cannot use them', () => {
    expect(topologyErrorsForNewApp([], { name: 'api', type: 'nestjs', ml: true })).toHaveLength(1);
    expect(topologyErrorsForNewApp([], { name: 'api', type: 'nestjs', tucuUi: true })).toHaveLength(1);
  });
});

describe('tucu-ui treatment of the new types', () => {
  it.each(['next-bff', 'mfe-shell', 'mfe'])('%s uses tucu-ui by default and honours the opt-out', (type) => {
    expect(appUsesTucuUi({ type })).toBe(true);
    expect(appUsesTucuUi({ type }, false)).toBe(false);
    expect(appUsesTucuUi({ type, tucuUi: false })).toBe(false);
    expect(resolveKitTucuUiFlag([{ type }], undefined)).toBe(true);
    expect(resolveKitTucuUiFlag([{ type, tucuUi: false }], undefined)).toBe(false);
  });

  it('python and nestjs never trigger the kit offer', () => {
    expect(resolveKitTucuUiFlag([{ type: 'python' }], undefined)).toBeUndefined();
  });

  it('keeps rejecting --tucu-ui together with --no-tucu-ui', () => {
    expect(hasConflictingTucuUiFlags(['mfe', '--tucu-ui', '--no-tucu-ui'])).toBe(true);
  });
});
