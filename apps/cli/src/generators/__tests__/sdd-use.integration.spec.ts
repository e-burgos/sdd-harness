import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

import { generateSDD } from '../sdd.generator.js';
import { createSpec } from '../spec.generator.js';

type UseJson = { ok: boolean; marker?: string; unit?: unknown; error?: string; open?: string[] };

describe.skipIf(process.platform === 'win32')('sdd-use.mjs (integration)', () => {
  let ws: string;
  let specId: string;

  const runUse = (...args: string[]) => {
    const run = spawnSync('node', [resolve(ws, 'sdd/scripts/sdd-use.mjs'), ...args], { encoding: 'utf-8' });
    const json = args.includes('--json') ? (JSON.parse(run.stdout) as UseJson) : undefined;
    return { status: run.status, stdout: run.stdout ?? '', output: `${run.stdout ?? ''}${run.stderr ?? ''}`, json };
  };

  const writeCycleStatus = (cycle: string, status: string) =>
    fs.outputJSON(resolve(ws, 'sdd/specs', specId, 'cycles', cycle, 'cycle.json'), { status });

  beforeAll(async () => {
    ws = mkdtempSync(resolve(tmpdir(), 'harness-use-'));
    await generateSDD(
      ws,
      {
        projectName: 'use-proj',
        description: 'Workspace used to exercise sdd:use.',
        packageScope: '@use',
        apps: [{ name: 'demo-api', type: 'nestjs' }],
        libs: [],
        services: [],
        sddProfile: 'solo',
      },
      { mergePackageJson: true },
    );
    const created = await createSpec(ws, { slug: 'orders', author: 'eburgos', app: 'apps/demo-api', title: 'Orders' });
    specId = created.specId;
    await writeCycleStatus('cycle-01', 'in-progress');
    await writeCycleStatus('cycle-02', 'completed');
    await fs.writeJSON(resolve(ws, 'sdd/fixes.json'), {
      fixes: [
        { id: 'FIX-eburgos-001', status: 'in-progress' },
        { id: 'FIX-eburgos-002', status: 'validated' },
      ],
    });
  });

  afterAll(() => {
    rmSync(ws, { recursive: true, force: true });
  });

  it('el kit registra el script sdd:use', async () => {
    const pkg = await fs.readJSON(resolve(ws, 'package.json'));
    expect(pkg.scripts['sdd:use']).toBe('node sdd/scripts/sdd-use.mjs');
  });

  it('sin argumentos imprime el uso y sale con 2', () => {
    const run = runUse();
    expect(run.status).toBe(2);
    expect(run.output).toContain('sdd:use');
  });

  it('ata un ciclo abierto: acepta slug y cycle corto e imprime la línea marcadora', () => {
    const run = runUse('orders', '1');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(`SDD-BIND spec=${specId} cycle=cycle-01`);

    const asJson = runUse(specId, 'cycle-01', '--json');
    expect(asJson.status).toBe(0);
    expect(asJson.json).toEqual({
      ok: true,
      unit: { kind: 'cycle', spec: specId, cycle: 'cycle-01' },
      marker: `SDD-BIND spec=${specId} cycle=cycle-01`,
    });
  });

  it('ata un fix abierto', () => {
    const run = runUse('FIX-eburgos-001', '--json');
    expect(run.status).toBe(0);
    expect(run.json?.marker).toBe('SDD-BIND fix=FIX-eburgos-001');
  });

  it('rechaza un ciclo cerrado y lista las unidades abiertas', () => {
    const run = runUse('orders', 'cycle-02', '--json');
    expect(run.status).toBe(1);
    expect(run.json?.ok).toBe(false);
    expect(run.json?.open).toEqual([`${specId}/cycle-01`, 'FIX-eburgos-001']);
    expect(runUse('orders', 'cycle-02').output).toContain('pnpm sdd:use FIX-eburgos-001');
  });

  it('rechaza un fix cerrado o inexistente', () => {
    expect(runUse('FIX-eburgos-002').output).toContain('validated');
    expect(runUse('FIX-eburgos-999').status).toBe(1);
  });

  it('una spec sin ciclo o desconocida es un error de uso', () => {
    expect(runUse('orders').status).toBe(2);
    expect(runUse('nope', 'cycle-01').status).toBe(2);
  });
});
