import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

import { generateSDD, registerSubprojectInSDD, seedVerifyEntries } from '../sdd.generator.js';

const baseOpts = (apps: { name: string; type: string }[]) => ({
  projectName: 'verify-seed',
  description: 'Repo to exercise verify.json seeding.',
  packageScope: '@verify-seed',
  apps,
  libs: [],
  services: [],
});

describe.skipIf(process.platform === 'win32')('seedVerifyEntries con el script real del kit', () => {
  let root: string;
  const verify = () => fs.readJSON(resolve(root, 'sdd/verify.json'));

  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), 'harness-verify-seed-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('layout nx con dos apps: cada una recibe quick y full', async () => {
    await fs.writeJSON(resolve(root, 'nx.json'), {});
    await fs.writeJSON(resolve(root, 'package.json'), { name: 'verify-seed', version: '1.0.0', private: true });
    await generateSDD(root, baseOpts([{ name: 'portal', type: 'react' }, { name: 'orders', type: 'nestjs' }]));
    await fs.outputJSON(resolve(root, 'apps/portal/project.json'), { name: 'portal', targets: {} });
    await fs.outputJSON(resolve(root, 'apps/orders/project.json'), {
      name: 'orders',
      targets: { serve: {}, lint: {}, test: {} },
    });

    seedVerifyEntries(root);

    const config = await verify();
    expect(config['apps/portal'].quick).toEqual(['pnpm nx run-many -t lint test -p portal']);
    expect(config['apps/portal'].full).toEqual(['pnpm nx run-many -t lint test build -p portal']);
    expect(config['apps/orders'].quick).toEqual(['pnpm nx run-many -t lint test -p orders']);
    expect(config['apps/orders'].full).toEqual(['pnpm nx run-many -t lint test build -p orders']);
    expect(config['apps/portal'].full_exclusive).toBe(true);
  });

  it('layout standalone: la app lógica apps/<name> usa los scripts del package.json raíz', async () => {
    await fs.writeJSON(resolve(root, 'package.json'), {
      name: 'verify-seed',
      version: '1.0.0',
      private: true,
      scripts: { lint: 'eslint .', test: 'vitest run', build: 'vite build' },
    });
    await generateSDD(root, baseOpts([{ name: 'verify-seed', type: 'react' }]), {
      layout: 'standalone',
      mergePackageJson: true,
    });

    seedVerifyEntries(root);

    const entry = (await verify())['apps/verify-seed'];
    expect(entry.quick).toEqual(['pnpm run lint', 'pnpm run test']);
    expect(entry.full).toEqual(['pnpm run lint', 'pnpm run test', 'pnpm run build']);
  });

  it('un subproyecto nuevo suma su entrada y la que el dev editó queda intacta', async () => {
    await fs.writeJSON(resolve(root, 'nx.json'), {});
    await fs.writeJSON(resolve(root, 'package.json'), { name: 'verify-seed', version: '1.0.0', private: true });
    await generateSDD(root, baseOpts([{ name: 'portal', type: 'react' }]));
    seedVerifyEntries(root);

    const config = await verify();
    config['apps/portal'] = { quick: ['pnpm vitest run --changed'], full: ['pnpm run mine'] };
    await fs.writeJSON(resolve(root, 'sdd/verify.json'), config, { spaces: 2 });
    const edited = JSON.stringify(config['apps/portal']);

    await registerSubprojectInSDD(root, 'apps', 'billing', 'nestjs');
    await registerSubprojectInSDD(root, 'tools', 'scripts', 'tool');
    await fs.outputJSON(resolve(root, 'apps/billing/project.json'), { name: 'billing', targets: {} });
    seedVerifyEntries(root);

    const after = await verify();
    expect(JSON.stringify(after['apps/portal'])).toBe(edited);
    expect(after['tools/scripts']).toBeUndefined();
    expect(after['apps/billing'].full).toEqual(['pnpm nx run-many -t lint test build -p billing']);
  });
});
