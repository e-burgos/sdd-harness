import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';
import { addAppCommand, topologyErrorsForNewApp, ADD_APP_TYPE_OPTIONS } from '../add/app.js';
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
});

describe('topologyErrorsForNewApp', () => {
  it('flags an mfe pointing at a missing or non-shell app, ignoring unrelated problems', () => {
    const existing = [
      { name: 'web', type: 'react' },
      { name: 'stray', type: 'mfe' },
    ];
    expect(topologyErrorsForNewApp(existing, { name: 'orders', type: 'mfe', shell: 'ghost' })).toHaveLength(1);
    expect(topologyErrorsForNewApp(existing, { name: 'orders', type: 'mfe', shell: 'web' })[0]).toContain('mfe-shell');
    expect(topologyErrorsForNewApp([], { name: 'portal', type: 'mfe-shell' })).toEqual([]);
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
