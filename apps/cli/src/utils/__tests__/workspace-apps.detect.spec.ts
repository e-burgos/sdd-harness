import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

vi.mock('../exec.js', () => ({
  exec: vi.fn(() => ''),
  execSilent: vi.fn(() => ''),
}));

import { generateApp, resolveAppPorts, type AppSpec } from '../../generators/app.generator.js';
import { generateLib } from '../../generators/lib.generator.js';
import { resolveMfeShell } from '../../generators/app-types.js';
import { readRegisteredApps } from '../workspace-apps.js';
import { detectAppType, discoverNxApplications } from '../../commands/configure/sdd-apps.js';

const MONO: AppSpec[] = [
  { name: 'core-api', type: 'nestjs', port: 3000 },
  { name: 'web', type: 'react' },
  { name: 'site', type: 'nextjs', port: 3100 },
  { name: 'portal-bff', type: 'next-bff' },
  { name: 'portal', type: 'mfe-shell' },
  { name: 'billing', type: 'mfe' },
  { name: 'reports', type: 'mfe' },
  { name: 'audit', type: 'mfe', shell: 'portal' },
  { name: 'agent-api', type: 'python' },
];

describe('workspace shaped like gen-012-mono', () => {
  let root: string;

  beforeAll(async () => {
    root = mkdtempSync(resolve(tmpdir(), 'harness-mono-detect-'));
    await fs.writeJSON(resolve(root, 'nx.json'), {});
    await fs.writeJSON(resolve(root, 'package.json'), { name: '@g12/repo' });
    await generateLib(root, { name: 'shared-types', type: 'shared-types' }, '@g12');
    for (const app of MONO) await generateApp(root, app, '@g12', { apps: MONO });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('assigns a unique port to every app', () => {
    const ports = [...resolveAppPorts(MONO).values()];
    expect(new Set(ports).size).toBe(MONO.length);
    expect(resolveAppPorts(MONO).get('web')).toBe(4200);
    expect(resolveAppPorts(MONO).get('portal')).toBe(4300);
  });

  it('keeps the ports consistent between the apps, the shell proxy and .env', async () => {
    const proxy = await fs.readFile(resolve(root, 'apps/portal/vite.config.ts'), 'utf-8');
    const ports = resolveAppPorts(MONO);
    for (const mfe of ['billing', 'reports', 'audit']) {
      const generated = await fs.readFile(resolve(root, `apps/${mfe}/vite.config.ts`), 'utf-8');
      expect(generated).toContain(`?? ${ports.get(mfe)})`);
      expect(proxy).toContain(`${mfe.toUpperCase()}_PORT'] ?? ${ports.get(mfe)}`);
    }
  });

  it.each([
    ['core-api', 'nestjs'],
    ['web', 'react'],
    ['site', 'nextjs'],
    ['portal-bff', 'next-bff'],
    ['portal', 'mfe-shell'],
    ['billing', 'mfe'],
    ['agent-api', 'python'],
  ])('detects %s as %s from the files the generators write', (name, type) => {
    expect(detectAppType(resolve(root, 'apps', name))).toBe(type);
  });

  it('discovers the apps and recovers each mfe shell from the shell proxy', () => {
    const found = discoverNxApplications(root);
    expect(found.map((app) => `${app.name}:${app.type}`).sort()).toEqual(
      MONO.map((app) => `${app.name}:${app.type}`).sort(),
    );
    const mfes = found.filter((app) => app.type === 'mfe');
    expect(mfes).toHaveLength(3);
    for (const mfe of mfes) expect(mfe.shell).toBe('portal');
    expect(resolveMfeShell(mfes[0], found)?.name).toBe('portal');
  });

  it('reads the registry, falling back to on-disk detection when a description does not parse', async () => {
    await fs.outputJSON(resolve(root, 'sdd/global.json'), {
      monorepo: {
        apps: {
          'core-api': 'apps/core-api — nestjs',
          web: 'the web frontend',
          portal: '???',
          billing: 'no type here',
          audit: 'apps/audit — mfe (shell: portal)',
          ghost: 'not on disk and not parseable',
        },
      },
    });
    const apps = readRegisteredApps(root);
    const byName = Object.fromEntries(apps.map((app) => [app.name, app]));
    expect(byName['web'].type).toBe('react');
    expect(byName['portal'].type).toBe('mfe-shell');
    expect(byName['billing']).toMatchObject({ type: 'mfe', shell: 'portal' });
    expect(byName['audit']).toMatchObject({ type: 'mfe', shell: 'portal' });
    expect(byName['ghost']).toBeUndefined();
  });

  it('reads the real port of every app from disk', async () => {
    await fs.outputJSON(resolve(root, 'sdd/global.json'), {
      monorepo: {
        apps: Object.fromEntries(MONO.map((app) => [app.name, `apps/${app.name} — ${app.type}`])),
      },
    });
    const ports = resolveAppPorts(MONO);
    const registered = Object.fromEntries(readRegisteredApps(root).map((app) => [app.name, app.port]));
    for (const name of ['core-api', 'web', 'site', 'portal-bff', 'portal', 'billing', 'reports', 'audit']) {
      expect(registered[name]).toBe(ports.get(name));
    }
  });
});
