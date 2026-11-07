import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, delimiter, dirname } from 'node:path';
import { chmodSync, mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import fs from 'fs-extra';

import { generateSDD } from '../sdd.generator.js';
import { createSpec } from '../spec.generator.js';

type Json = Record<string, unknown>;

const FAKE_URL = 'https://github.com/acme/demo/pull/7';

const gitIn = (cwd: string, ...args: string[]) =>
  spawnSync('git', args, { cwd, encoding: 'utf-8' });

async function makeWorkspace(profile: 'team' | 'solo', prefix: string) {
  const ws = mkdtempSync(resolve(tmpdir(), prefix));
  await generateSDD(
    ws,
    {
      projectName: 'branch-proj',
      description: 'Workspace used to exercise sdd:branch and sdd:pr.',
      packageScope: '@br',
      apps: [{ name: 'demo-api', type: 'nestjs' }],
      libs: [],
      services: [],
      sddProfile: profile,
    },
    { mergePackageJson: true },
  );
  const created = await createSpec(ws, { slug: 'orders', author: 'eburgos', app: 'apps/demo-api', title: 'Orders' });
  await fs.outputJSON(resolve(ws, 'sdd/specs', created.specId, 'cycles/cycle-01/cycle.json'), {
    status: 'in-progress',
    module: 'orders',
    objectives: ['Create orders'],
  });
  await fs.outputJSON(resolve(ws, 'sdd/specs', created.specId, 'cycles/cycle-02/cycle.json'), { status: 'completed' });
  gitIn(ws, 'init', '-b', 'main');
  gitIn(ws, 'config', 'user.email', 't@t.t');
  gitIn(ws, 'config', 'user.name', 't');
  gitIn(ws, 'config', 'commit.gpgsign', 'false');
  gitIn(ws, 'add', '-A');
  gitIn(ws, 'commit', '-m', 'init');
  return { ws, specId: created.specId };
}

describe.skipIf(process.platform === 'win32')('sdd-branch.mjs and sdd-pr.mjs (integration)', () => {
  let team: { ws: string; specId: string };
  let solo: { ws: string; specId: string };
  let bare: string;
  let binDir: string;
  let emptyBin: string;
  let ghLog: string;

  const script = (ws: string, name: string, args: string[], env: NodeJS.ProcessEnv = process.env) => {
    const run = spawnSync('node', [resolve(ws, 'sdd/scripts', name), ...args], { encoding: 'utf-8', cwd: ws, env });
    const json = args.includes('--json') ? (JSON.parse(run.stdout) as Json) : undefined;
    return { status: run.status, stdout: run.stdout ?? '', output: `${run.stdout ?? ''}${run.stderr ?? ''}`, json };
  };

  const currentBranch = (ws: string) => gitIn(ws, 'rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();

  const ghEnv = (): NodeJS.ProcessEnv => ({
    ...process.env,
    PATH: `${binDir}${delimiter}${process.env["PATH"]}`,
    GH_LOG: ghLog,
  });

  beforeAll(async () => {
    team = await makeWorkspace('team', 'harness-branch-team-');
    solo = await makeWorkspace('solo', 'harness-branch-solo-');
    bare = mkdtempSync(resolve(tmpdir(), 'harness-branch-origin-'));
    spawnSync('git', ['init', '--bare', '-b', 'main'], { cwd: bare });
    gitIn(team.ws, 'remote', 'add', 'origin', bare);

    binDir = mkdtempSync(resolve(tmpdir(), 'harness-fake-gh-'));
    ghLog = resolve(binDir, 'gh.log');
    const ghScript = [
      '#!/bin/sh',
      'echo "$@" >> "$GH_LOG"',
      'case "$1 $2" in',
      '  "pr view") exit 1 ;;',
      `  "pr create") echo "${FAKE_URL}"; exit 0 ;;`,
      'esac',
      'exit 0',
      '',
    ].join('\n');
    const ghPath = resolve(binDir, 'gh');
    await fs.writeFile(ghPath, ghScript);
    chmodSync(ghPath, 0o755);
    emptyBin = mkdtempSync(resolve(tmpdir(), 'harness-no-gh-'));
  });

  afterAll(() => {
    for (const dir of [team?.ws, solo?.ws, bare, binDir, emptyBin]) {
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('el kit registra los scripts sdd:branch y sdd:pr', async () => {
    const pkg = await fs.readJSON(resolve(team.ws, 'package.json'));
    expect(pkg.scripts['sdd:branch']).toBe('node sdd/scripts/sdd-branch.mjs');
    expect(pkg.scripts['sdd:pr']).toBe('node sdd/scripts/sdd-pr.mjs');
  });

  it('sin argumentos ambos imprimen el uso y salen con 2', () => {
    expect(script(team.ws, 'sdd-branch.mjs', []).status).toBe(2);
    expect(script(team.ws, 'sdd-pr.mjs', []).status).toBe(2);
    expect(script(team.ws, 'sdd-branch.mjs', ['orders']).status).toBe(2);
    expect(script(team.ws, 'sdd-branch.mjs', ['nope', 'cycle-01']).status).toBe(2);
  });

  it('un ciclo que no está en curso sale con 1', () => {
    expect(script(team.ws, 'sdd-branch.mjs', ['orders', 'cycle-02']).status).toBe(1);
    expect(script(team.ws, 'sdd-branch.mjs', ['orders', 'cycle-09', '--json']).json?.["ok"]).toBe(false);
  });

  it('perfil team: crea la rama del ciclo y luego se mantiene en ella', () => {
    const slugBranch = 'feat/orders-cycle-01';
    const created = script(team.ws, 'sdd-branch.mjs', ['orders', '1', '--json']);
    expect(created.status).toBe(0);
    expect(created.json).toMatchObject({ ok: true, branch: slugBranch, created: true, switched: true, policy: 'on' });
    expect(currentBranch(team.ws)).toBe(slugBranch);

    const again = script(team.ws, 'sdd-branch.mjs', [team.specId, 'cycle-01', '--json']);
    expect(again.json).toMatchObject({ ok: true, created: false, switched: false });
  });

  it('cambia a la rama existente cuando se está en otra', () => {
    gitIn(team.ws, 'switch', 'main');
    const run = script(team.ws, 'sdd-branch.mjs', ['orders', 'cycle-01', '--json']);
    expect(run.json).toMatchObject({ ok: true, created: false, switched: true });
    expect(currentBranch(team.ws)).toBe('feat/orders-cycle-01');
  });

  it('perfil solo: no toca nada y explica cómo forzar; con --force crea la rama', () => {
    const skipped = script(solo.ws, 'sdd-branch.mjs', ['orders', 'cycle-01', '--json']);
    expect(skipped.status).toBe(0);
    expect(skipped.json).toMatchObject({ ok: true, skipped: true, branch: 'feat/orders-cycle-01', policy: 'off' });
    expect(currentBranch(solo.ws)).toBe('main');

    const text = script(solo.ws, 'sdd-branch.mjs', ['orders', 'cycle-01']);
    expect(text.output).toContain('--force');

    const forced = script(solo.ws, 'sdd-branch.mjs', ['orders', 'cycle-01', '--force', '--json']);
    expect(forced.json).toMatchObject({ ok: true, created: true, policy: 'off' });
    expect(currentBranch(solo.ws)).toBe('feat/orders-cycle-01');
  });

  it('fuera de un repo git sale con 1', async () => {
    const lone = await makeWorkspace('team', 'harness-branch-nogit-');
    rmSync(resolve(lone.ws, '.git'), { recursive: true, force: true });
    const run = script(lone.ws, 'sdd-branch.mjs', ['orders', 'cycle-01']);
    expect(run.status).toBe(1);
    rmSync(lone.ws, { recursive: true, force: true });
  });

  it('sdd:pr sin --yes solo muestra el plan', () => {
    const run = script(team.ws, 'sdd-pr.mjs', ['orders', 'cycle-01', '--json'], ghEnv());
    expect(run.status).toBe(0);
    const plan = run.json?.["plan"] as { branch: string; base: string; title: string; body: string };
    expect(run.json).toMatchObject({ ok: false, needsConfirmation: true });
    expect(plan.branch).toBe('feat/orders-cycle-01');
    expect(plan.base).toBe('main');
    expect(plan.title).toContain(team.specId);
    expect(plan.body).toContain('Create orders');
    expect(existsSync(ghLog)).toBe(false);

    const text = script(team.ws, 'sdd-pr.mjs', ['orders', 'cycle-01'], ghEnv());
    expect(text.output).toContain('--yes');
  });

  it('sdd:pr --yes pushea al origin y llama a gh con los argumentos correctos', () => {
    const run = script(team.ws, 'sdd-pr.mjs', ['orders', 'cycle-01', '--yes', '--json'], ghEnv());
    expect(run.status).toBe(0);
    expect(run.json).toEqual({ ok: true, url: FAKE_URL, created: true });

    const heads = spawnSync('git', ['branch', '--list'], { cwd: bare, encoding: 'utf-8' }).stdout;
    expect(heads).toContain('feat/orders-cycle-01');

    const calls = readFileSync(ghLog, 'utf-8').trim().split('\n');
    expect(calls[0]).toBe('--version');
    expect(calls.some((c) => c === 'pr view feat/orders-cycle-01 --json url')).toBe(true);
    const create = calls.find((c) => c.startsWith('pr create'));
    expect(create).toContain('--base main');
    expect(create).toContain('--head feat/orders-cycle-01');
    expect(create).toContain(`--title feat(orders):`);
    expect(create).toContain('--body-file');
  });

  it('sdd:pr --yes sin gh disponible sale con 1', () => {
    const env = { ...process.env, PATH: `${emptyBin}${delimiter}${dirname(process.execPath)}${delimiter}/usr/bin${delimiter}/bin` };
    const run = script(team.ws, 'sdd-pr.mjs', ['orders', 'cycle-01', '--yes'], env);
    expect(run.status).toBe(1);
    expect(run.output).toContain('gh');
  });
});
