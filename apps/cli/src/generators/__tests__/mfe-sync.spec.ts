import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';
import { generateApp, type AppSpec } from '../app.generator.js';
import { syncMfeShell } from '../mfe-sync.js';

vi.mock('../../utils/exec.js', () => ({
  exec: vi.fn(() => ''),
  execSilent: vi.fn(() => ''),
}));

const read = (root: string, rel: string) => fs.readFileSync(resolve(root, rel), 'utf-8');

describe('syncMfeShell', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), 'harness-mfe-sync-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it.each([
    ['tucu-ui', true, "{\n    \"name\": \"orders\""],
    ['plain', false, '["orders"]'],
  ])('adds a new mfe to an existing %s shell in proxy, menu, nginx and Dockerfile', async (_label, tucuUi, listFragment) => {
    const shell: AppSpec = { name: 'portal', type: 'mfe-shell', tucuUi };
    await generateApp(root, shell, '@t', { apps: [shell] });
    expect(read(root, 'apps/portal/nginx.conf')).not.toContain('/orders/');

    const orders: AppSpec = { name: 'orders', type: 'mfe', tucuUi };
    const apps = [shell, orders];
    await generateApp(root, orders, '@t', { apps });
    expect(await syncMfeShell(root, shell, apps)).toBe(true);

    expect(read(root, 'apps/portal/nginx.conf')).toContain('location /orders/');
    expect(read(root, 'apps/portal/Dockerfile')).toContain('/usr/share/nginx/html/orders');
    expect(read(root, 'apps/portal/Dockerfile')).toContain('-p portal,orders');
    expect(read(root, 'apps/portal/vite.config.ts')).toContain("'/orders/'");
    expect(read(root, 'apps/portal/vite.config.ts')).toContain('ORDERS_PORT');
    expect(read(root, 'apps/portal/src/app/app.tsx')).toContain(listFragment);
    expect(read(root, 'apps/portal/README.md')).toContain('`orders`');
  });

  it('is idempotent: syncing twice leaves one proxy block and one entry per mfe', async () => {
    const shell: AppSpec = { name: 'portal', type: 'mfe-shell' };
    const orders: AppSpec = { name: 'orders', type: 'mfe' };
    const billing: AppSpec = { name: 'billing', type: 'mfe' };
    const apps = [shell, orders, billing];
    await generateApp(root, shell, '@t', { apps: [shell] });

    await syncMfeShell(root, shell, apps);
    const first = ['vite.config.ts', 'nginx.conf', 'Dockerfile', 'src/app/app.tsx'].map((f) =>
      read(root, `apps/portal/${f}`),
    );
    await syncMfeShell(root, shell, apps);
    const second = ['vite.config.ts', 'nginx.conf', 'Dockerfile', 'src/app/app.tsx'].map((f) =>
      read(root, `apps/portal/${f}`),
    );

    expect(second).toEqual(first);
    const vite = first[0];
    expect(vite.match(/const mfeProxy =/g)).toHaveLength(1);
    expect(vite.match(/'\/orders\/'/g)).toHaveLength(1);
    expect(vite).toContain('proxy: mfeProxy');
    expect(vite.match(/proxy: mfeProxy/g)).toHaveLength(1);
  });

  it('a shell generated after its mfes already lists them', async () => {
    const shell: AppSpec = { name: 'portal', type: 'mfe-shell' };
    const orders: AppSpec = { name: 'orders', type: 'mfe', shell: 'portal' };
    await generateApp(root, shell, '@t', { apps: [orders, shell] });
    expect(read(root, 'apps/portal/nginx.conf')).toContain('location /orders/');
  });

  it('returns false when the shell has no folder', async () => {
    const shell: AppSpec = { name: 'ghost', type: 'mfe-shell' };
    expect(await syncMfeShell(root, shell, [shell])).toBe(false);
  });
});
