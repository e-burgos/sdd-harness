import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';
import { readRegisteredApps } from '../workspace-apps.js';

describe('readRegisteredApps', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), 'harness-registry-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reads type and mfe shell from sdd/global.json monorepo.apps', () => {
    fs.outputJSONSync(resolve(root, 'sdd/global.json'), {
      monorepo: {
        apps: {
          portal: 'apps/portal — mfe-shell',
          orders: 'apps/orders — mfe (shell: portal)',
          bff: 'apps/bff — next-bff',
          moved: 'src/moved — react (código en src/moved; id lógico apps/moved)',
        },
      },
    });
    expect(readRegisteredApps(root)).toEqual([
      { name: 'portal', type: 'mfe-shell' },
      { name: 'orders', type: 'mfe', shell: 'portal' },
      { name: 'bff', type: 'next-bff' },
      { name: 'moved', type: 'react' },
    ]);
  });

  it('returns an empty list without a registry', () => {
    expect(readRegisteredApps(root)).toEqual([]);
  });
});
