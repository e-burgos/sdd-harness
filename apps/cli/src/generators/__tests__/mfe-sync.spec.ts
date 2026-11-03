import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';
import { generateApp, type AppSpec } from '../app.generator.js';
import { syncMfeShell } from '../mfe-sync.js';
import { logger } from '../../utils/logger.js';

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

  it('keeps the explicit port of an existing mfe, read back from the shell proxy', async () => {
    const shell: AppSpec = { name: 'portal', type: 'mfe-shell' };
    const billing: AppSpec = { name: 'billing', type: 'mfe', port: 5001 };
    await generateApp(root, shell, '@t', { apps: [shell, billing] });
    expect(read(root, 'apps/portal/vite.config.ts')).toContain("BILLING_PORT'] ?? 5001");

    const registered: AppSpec[] = [shell, { name: 'billing', type: 'mfe' }, { name: 'audit', type: 'mfe' }];
    await syncMfeShell(root, shell, registered);

    const vite = read(root, 'apps/portal/vite.config.ts');
    expect(vite).toContain("BILLING_PORT'] ?? 5001");
    expect(vite).toContain("AUDIT_PORT'] ?? 4301");
    expect(read(root, 'apps/portal/README.md')).toContain('(default 5001)');
  });

  it('gives a new mfe a port that collides with no known port', async () => {
    const shell: AppSpec = { name: 'portal', type: 'mfe-shell' };
    const billing: AppSpec = { name: 'billing', type: 'mfe', port: 4301 };
    await generateApp(root, shell, '@t', { apps: [shell, billing] });
    await syncMfeShell(root, shell, [shell, { name: 'billing', type: 'mfe' }, { name: 'audit', type: 'mfe' }]);
    const vite = read(root, 'apps/portal/vite.config.ts');
    expect(vite).toContain("BILLING_PORT'] ?? 4301");
    expect(vite).toContain("AUDIT_PORT'] ?? 4302");
  });

  describe('hand-edited generated files', () => {
    const shell: AppSpec = { name: 'portal', type: 'mfe-shell' };
    const orders: AppSpec = { name: 'orders', type: 'mfe' };
    const billing: AppSpec = { name: 'billing', type: 'mfe' };

    it('wraps the mfe-specific parts in markers and keeps edits made outside them', async () => {
      await generateApp(root, shell, '@t', { apps: [shell, orders] });
      const nginx = read(root, 'apps/portal/nginx.conf');
      expect(nginx).toContain('# harness:mfe-start');
      expect(nginx).toContain('# harness:mfe-end');
      expect(read(root, 'apps/portal/Dockerfile').match(/# harness:mfe-start/g)).toHaveLength(2);
      expect(read(root, 'apps/portal/README.md')).toContain('<!-- harness:mfe-start -->');

      fs.writeFileSync(
        resolve(root, 'apps/portal/nginx.conf'),
        nginx.replace('gzip on;', 'gzip on;\n    client_max_body_size 50m;'),
      );
      fs.appendFileSync(resolve(root, 'apps/portal/README.md'), '\nTeam notes.\n');
      fs.appendFileSync(resolve(root, 'apps/portal/Dockerfile'), '\nLABEL team=portal\n');

      await syncMfeShell(root, shell, [shell, orders, billing]);

      expect(read(root, 'apps/portal/nginx.conf')).toContain('client_max_body_size 50m;');
      expect(read(root, 'apps/portal/nginx.conf')).toContain('location /billing/');
      expect(read(root, 'apps/portal/README.md')).toContain('Team notes.');
      expect(read(root, 'apps/portal/README.md')).toContain('`billing`');
      expect(read(root, 'apps/portal/Dockerfile')).toContain('LABEL team=portal');
      expect(read(root, 'apps/portal/Dockerfile')).toContain('-p portal,orders,billing');
    });

    it('warns and leaves a file without markers untouched', async () => {
      await generateApp(root, shell, '@t', { apps: [shell, orders] });
      const handWritten = 'server { listen 80; }\n';
      fs.writeFileSync(resolve(root, 'apps/portal/nginx.conf'), handWritten);
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

      await syncMfeShell(root, shell, [shell, orders, billing]);

      expect(read(root, 'apps/portal/nginx.conf')).toBe(handWritten);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('apps/portal/nginx.conf');
      expect(warn.mock.calls[0][0]).toContain('orders, billing');
      expect(read(root, 'apps/portal/Dockerfile')).toContain('-p portal,orders,billing');
      warn.mockRestore();
    });
  });
});
