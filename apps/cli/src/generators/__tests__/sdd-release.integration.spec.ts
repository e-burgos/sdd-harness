import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import fs from 'fs-extra';

import { generateSDD } from '../sdd.generator.js';

type ReleaseJson = {
  ok: boolean;
  released?: { path: string; notified: string[] }[];
  missing?: string[];
  leases?: { path: string }[];
};

describe.skipIf(process.platform === 'win32')('sdd-release.mjs (integration)', () => {
  let ws: string;
  let registryDir: string;
  type Lib = {
    acquireLease: (...args: unknown[]) => Promise<{ lease: unknown }>;
    requestLease: (...args: unknown[]) => Promise<unknown>;
    listInbox: (...args: unknown[]) => Promise<{ kind: string }[]>;
  };
  let lib: Lib;

  const nodeFs = {
    read: (path: string) => fs.readFile(path, 'utf8'),
    write: (path: string, text: string) => fs.outputFile(path, text),
    list: async (path: string) => (await fs.readdir(path)).map((name) => ({ name })),
  };

  const runRelease = (...args: string[]) => {
    const run = spawnSync('node', [resolve(ws, 'sdd/scripts/sdd-release.mjs'), ...args], {
      encoding: 'utf-8',
      cwd: ws,
      env: { ...process.env, INIT_CWD: ws },
    });
    const json = args.includes('--json') ? (JSON.parse(run.stdout) as ReleaseJson) : undefined;
    return { status: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}`, json };
  };

  beforeAll(async () => {
    ws = mkdtempSync(resolve(tmpdir(), 'harness-release-'));
    await generateSDD(
      ws,
      {
        projectName: 'release-proj',
        description: 'Workspace used to exercise sdd:release.',
        packageScope: '@rel',
        apps: [{ name: 'demo-api', type: 'nestjs' }],
        libs: [],
        services: [],
        sddProfile: 'solo',
      },
      { mergePackageJson: true },
    );
    await fs.outputFile(resolve(ws, '.git/HEAD'), 'ref: refs/heads/main\n');
    lib = (await import(pathToFileURL(resolve(ws, 'sdd/scripts/lib/session-registry.mjs')).href)) as Lib;
    registryDir = resolve(ws, '.git/sdd-sessions');
    const now = Date.now();
    const { lease } = (await lib.acquireLease(nodeFs, registryDir, {
      rel: 'apps/demo-api/src/main.ts',
      sessionId: 'owner',
      unit: { kind: 'fix', fix: 'FIX-x-001' },
      worktree: ws,
      harness: 'claude-code',
      now,
    }));
    await lib.requestLease(nodeFs, registryDir, { lease, fromSessionId: 'asker', fromUnit: null, now: now + 1 });
  });

  afterAll(() => {
    rmSync(ws, { recursive: true, force: true });
  });

  it('el kit registra el script sdd:release', async () => {
    const pkg = await fs.readJSON(resolve(ws, 'package.json'));
    expect(pkg.scripts['sdd:release']).toBe('node sdd/scripts/sdd-release.mjs');
  });

  it('lista las reservas vivas', () => {
    const run = runRelease('--list', '--json');
    expect(run.status).toBe(0);
    expect(run.json?.leases?.map((l) => l.path)).toEqual(['apps/demo-api/src/main.ts']);
  });

  it('libera la reserva y avisa a quien la pidió', async () => {
    const run = runRelease('apps/demo-api/src/main.ts', '--json');
    expect(run.status).toBe(0);
    expect(run.json?.released).toEqual([
      expect.objectContaining({ path: 'apps/demo-api/src/main.ts', notified: ['asker'] }),
    ]);
    const inbox = await lib.listInbox(nodeFs, registryDir, 'asker');
    expect(inbox.map((m) => m.kind)).toEqual(['lease-released']);
  });

  it('sale con 1 si el archivo no estaba reservado y con 2 sin argumentos', () => {
    expect(runRelease('apps/demo-api/src/main.ts').status).toBe(1);
    expect(runRelease().status).toBe(2);
  });
});
