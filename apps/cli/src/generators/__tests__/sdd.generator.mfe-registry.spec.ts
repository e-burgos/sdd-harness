import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

vi.mock('../../utils/exec.js', () => ({
  exec: vi.fn(() => ''),
  execSilent: vi.fn(() => ''),
}));

import { generateSDD } from '../sdd.generator.js';
import { describeAppStack } from '../app-types.js';

describe('sdd.generator — registry of mfes and stack descriptions', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), 'harness-sdd-mfe-registry-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('registers every mfe with its resolved shell, also when only one shell exists', async () => {
    await generateSDD(
      root,
      {
        projectName: 'multi-shell',
        description: 'Two shells.',
        packageScope: '@multi',
        apps: [
          { name: 'portal', type: 'mfe-shell' },
          { name: 'admin', type: 'mfe-shell' },
          { name: 'orders', type: 'mfe', shell: 'portal' },
          { name: 'ops', type: 'mfe', shell: 'admin' },
        ],
        libs: [],
        services: [],
      },
      { layout: 'nx', mergePackageJson: true },
    );
    const apps = (await fs.readJSON(resolve(root, 'sdd/global.json'))).monorepo.apps;
    expect(apps.orders).toBe('apps/orders — mfe (shell: portal)');
    expect(apps.ops).toBe('apps/ops — mfe (shell: admin)');
  });

  it('resolves the implicit single shell into the registry entry', async () => {
    await generateSDD(
      root,
      {
        projectName: 'one-shell',
        description: 'One shell.',
        packageScope: '@one',
        apps: [
          { name: 'portal', type: 'mfe-shell' },
          { name: 'orders', type: 'mfe' },
        ],
        libs: [],
        services: [],
      },
      { layout: 'nx', mergePackageJson: true },
    );
    const apps = (await fs.readJSON(resolve(root, 'sdd/global.json'))).monorepo.apps;
    expect(apps.orders).toBe('apps/orders — mfe (shell: portal)');
  });

  it('describes the stack from the real tucuUi value', async () => {
    expect(describeAppStack('react', false)).not.toContain('tucu-ui by default');
    expect(describeAppStack('react', false)).toContain('plain');
    expect(describeAppStack('react', true)).toContain('tucu-ui');
    expect(describeAppStack('react')).toContain('tucu-ui');
    expect(describeAppStack('nestjs', false)).toBe('NestJS (Webpack build, Jest)');

    await generateSDD(
      root,
      {
        projectName: 'plain-ui',
        description: 'Plain.',
        packageScope: '@plain',
        apps: [{ name: 'web', type: 'react', tucuUi: false }],
        libs: [],
        services: [],
      },
      { layout: 'nx', mergePackageJson: true },
    );
    const constitution = await fs.readFile(resolve(root, 'sdd/context/apps/web/constitution.md'), 'utf-8');
    expect(constitution).toContain('plain (no tucu-ui)');
    expect(constitution).not.toContain('tucu-ui by default');
  });
});
