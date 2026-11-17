import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { resolve, join } from 'node:path';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { hostname, tmpdir } from 'node:os';
import fs from 'fs-extra';

import { generateSDD } from '../sdd.generator.js';
import { createSpec } from '../spec.generator.js';

type VerifyResult = {
  app: string;
  level: string;
  unit: string;
  ok: boolean;
  commit: string | null;
  dirty: string[];
  commands: { command: string; exit_code: number; skipped: boolean }[];
};

describe.skipIf(process.platform === 'win32')('sdd-verify.mjs (integration)', () => {
  let parent: string;
  let ws: string;
  let lockDir: string;
  let cycleDir: string;
  let specId: string;

  const git = (...args: string[]) => execFileSync('git', ['-C', ws, ...args], { encoding: 'utf-8' });

  const runVerify = (args: string[], env: Record<string, string> = {}) => {
    const run = spawnSync('node', [resolve(ws, 'sdd/scripts/sdd-verify.mjs'), ...args], {
      encoding: 'utf-8',
      cwd: ws,
      env: { ...process.env, SDD_VERIFY_LOCK_DIR: lockDir, ...env },
    });
    return { status: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}`, stdout: run.stdout ?? '' };
  };

  const writeConfig = async (entry: Record<string, unknown>) => {
    await fs.writeJSON(resolve(ws, 'sdd/verify.json'), { $schema: './schemas/verify.schema.json', 'apps/demo-api': entry });
  };

  const resultPath = (name: string) => join(cycleDir, 'artifacts/verify', name);
  const readResult = (name: string) => JSON.parse(readFileSync(resultPath(name), 'utf-8')) as VerifyResult;

  beforeAll(async () => {
    parent = mkdtempSync(resolve(tmpdir(), 'harness verify '));
    ws = join(parent, 'work space');
    await fs.ensureDir(ws);
    await generateSDD(ws, {
      projectName: 'verify-proj',
      description: 'Workspace used to exercise sdd:verify.',
      packageScope: '@verify',
      apps: [{ name: 'demo-api', type: 'nestjs' }],
      libs: [],
      services: [],
      sddProfile: 'solo',
    }, { mergePackageJson: true });
    const created = await createSpec(ws, { slug: 'orders', author: 'eburgos', app: 'apps/demo-api', title: 'Orders' });
    specId = created.specId;
    cycleDir = resolve(ws, created.folder, 'cycles', 'cycle-01');
    await fs.ensureDir(cycleDir);
    await fs.writeJSON(resolve(cycleDir, 'cycle.json'), {
      cycle: 1, module: 'orders', spec: specId, apps: ['apps/demo-api'], flow: 'lite', status: 'in-progress', started_at: '2026-09-08',
    });
    git('init', '-q');
    git('config', 'user.email', 't@t.t');
    git('config', 'user.name', 't');
    writeFileSync(join(ws, 'src.txt'), 'one');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    lockDir = join(parent, 'locks');
  });

  afterAll(() => rmSync(parent, { recursive: true, force: true }));

  beforeEach(() => {
    rmSync(join(cycleDir, 'artifacts/verify'), { recursive: true, force: true });
    rmSync(lockDir, { recursive: true, force: true });
  });

  it('kit ships the sdd:verify script and an empty verify.json', async () => {
    const pkg = await fs.readJSON(resolve(ws, 'package.json'));
    expect(pkg.scripts['sdd:verify']).toBe('node sdd/scripts/sdd-verify.mjs');
    expect(existsSync(resolve(ws, 'sdd/schemas/verify.schema.json'))).toBe(true);
  });

  it('runs an ok sequence compactly, writes the result and self-ignores the logs dir', async () => {
    await writeConfig({ quick: ['node -e "console.log([78,79,73,83,89].map(c=>String.fromCharCode(c)).join(\'\'))"', 'node -e "0"'] });
    const run = runVerify(['demo-api', 'quick', '--unit', 'TASK-001']);
    expect(run.status).toBe(0);
    expect(run.output).not.toContain('NOISY');
    expect(run.output).toContain('✔');
    expect(run.output).toContain('verify apps/demo-api quick OK');
    const result = readResult('TASK-001-quick.json');
    expect(result.ok).toBe(true);
    expect(result.unit).toBe('TASK-001');
    expect(result.commit).toBe(git('rev-parse', 'HEAD').trim());
    expect(result.commands).toHaveLength(2);
    const logs = join(cycleDir, 'artifacts/verify/logs');
    expect(readFileSync(join(logs, '.gitignore'), 'utf-8')).toBe('*\n');
    expect(readdirSync(logs).filter((name) => name.endsWith('.log'))).toHaveLength(2);
  });

  it('stops at the first failing command with exit 1 and prints the tail and the log path', async () => {
    await writeConfig({ quick: ['node -e "console.error(\'BOOM-LINE\');process.exit(3)"', 'node -e "0"'] });
    const run = runVerify(['apps/demo-api', 'quick']);
    expect(run.status).toBe(1);
    expect(run.output).toContain('✘');
    expect(run.output).toContain('BOOM-LINE');
    expect(run.output).toContain('full log:');
    const result = readResult('cycle-quick.json');
    expect(result.ok).toBe(false);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].exit_code).toBe(3);
  });

  it('skips {files} commands without --files and quotes them when given', async () => {
    await writeConfig({ quick: ['node -e "process.exit(process.argv.length>1?0:0)" {files}'] });
    const skipped = runVerify(['demo-api', 'quick', '--json']);
    expect(skipped.status).toBe(0);
    expect(JSON.parse(skipped.stdout).commands[0].skipped).toBe(true);
    const used = runVerify(['demo-api', 'quick', '--files', 'a b.ts,c.ts', '--json']);
    const command = JSON.parse(used.stdout).commands[0];
    expect(command.skipped).toBe(false);
    expect(command.command).toContain(`'a b.ts' 'c.ts'`);
  });

  it('exits 3 when the subproject has no entry or the level is empty, 2 on bad usage', async () => {
    await writeConfig({ full: ['node -e "0"'] });
    expect(runVerify(['demo-api', 'quick']).status).toBe(3);
    expect(runVerify(['ghost', 'full']).status).toBe(3);
    expect(runVerify(['demo-api']).status).toBe(2);
    expect(runVerify(['demo-api', 'quick', '--reuse']).status).toBe(2);
  });

  it('--reuse reuses a green full result while only sdd/ moves, and reruns when code moves', async () => {
    await writeConfig({ full: ['node -e "0"'] });
    expect(runVerify(['demo-api', 'full', '--unit', 'B-01']).status).toBe(0);
    writeFileSync(join(ws, 'sdd/notes.md'), 'x');
    git('add', '-A');
    git('commit', '-q', '-m', 'sdd only');
    const reused = runVerify(['demo-api', 'full', '--reuse']);
    expect(reused.status).toBe(0);
    expect(reused.output).toContain('reused');
    expect(existsSync(resultPath('cycle-full.json'))).toBe(false);
    writeFileSync(join(ws, 'src.txt'), 'two');
    git('add', '-A');
    git('commit', '-q', '-m', 'code');
    const rerun = runVerify(['demo-api', 'full', '--reuse']);
    expect(rerun.output).not.toContain('reused');
    expect(rerun.output).toContain('verify apps/demo-api full OK');
    expect(existsSync(resultPath('cycle-full.json'))).toBe(true);
  });

  it('--reuse does not reuse when a non-sdd file is dirty', async () => {
    await writeConfig({ full: ['node -e "0"'] });
    expect(runVerify(['demo-api', 'full', '--unit', 'B-01']).status).toBe(0);
    writeFileSync(join(ws, 'src.txt'), 'dirty');
    const run = runVerify(['demo-api', 'full', '--reuse']);
    expect(run.output).not.toContain('reused');
    expect(readResult('cycle-full.json').dirty).toEqual(['src.txt']);
    git('checkout', '--', 'src.txt');
  });

  it('a second process waits on the lease and exits 75 after --wait, then proceeds once released', async () => {
    await writeConfig({ full: ['node -e "setTimeout(()=>{},1500)"'], full_exclusive: true });
    const holder = spawn('node', [resolve(ws, 'sdd/scripts/sdd-verify.mjs'), 'demo-api', 'full'], {
      cwd: ws,
      env: { ...process.env, SDD_VERIFY_LOCK_DIR: lockDir },
      stdio: 'ignore',
    });
    const holderDone = new Promise((done) => holder.on('close', done));
    const lockFile = join(lockDir, 'verify-full.lock');
    for (let attempts = 0; attempts < 100 && !existsSync(lockFile); attempts++) await new Promise((r) => setTimeout(r, 50));
    expect(existsSync(lockFile)).toBe(true);
    const blocked = runVerify(['demo-api', 'full', '--wait', '1']);
    expect(blocked.status).toBe(75);
    expect(blocked.output).toContain('waiting for the full-verify lease');
    await holderDone;
    expect(existsSync(lockFile)).toBe(false);
  });

  it('takes a stale lease whose pid is dead and releases it after the run', async () => {
    await writeConfig({ full: ['node -e "0"'], full_exclusive: true });
    await fs.ensureDir(lockDir);
    const dead = spawnSync(process.execPath, ['-e', '0']).pid;
    writeFileSync(join(lockDir, 'verify-full.lock'), JSON.stringify({ pid: dead, host: hostname(), repo: '/gone' }));
    expect(runVerify(['demo-api', 'full']).status).toBe(0);
    expect(existsSync(join(lockDir, 'verify-full.lock'))).toBe(false);
  });

  it('releases the lease when the command fails', async () => {
    await writeConfig({ full: ['node -e "process.exit(1)"'], full_exclusive: true });
    expect(runVerify(['demo-api', 'full']).status).toBe(1);
    expect(existsSync(join(lockDir, 'verify-full.lock'))).toBe(false);
  });

  it('releases the lease when the process is terminated', async () => {
    await writeConfig({ full: ['node -e "setTimeout(()=>{},10000)"'], full_exclusive: true });
    const child = spawn('node', [resolve(ws, 'sdd/scripts/sdd-verify.mjs'), 'demo-api', 'full'], {
      cwd: ws,
      env: { ...process.env, SDD_VERIFY_LOCK_DIR: lockDir },
      stdio: 'ignore',
    });
    const closed = new Promise((done) => child.on('close', done));
    const lockFile = join(lockDir, 'verify-full.lock');
    for (let attempts = 0; attempts < 100 && !existsSync(lockFile); attempts++) await new Promise((r) => setTimeout(r, 50));
    child.kill('SIGTERM');
    await closed;
    expect(existsSync(lockFile)).toBe(false);
  });

  it('SIGTERM kills the whole tree of the running command and releases the lease', async () => {
    const pidFile = join(parent, 'grandchild.pid');
    const grandchild = `node -e "require('fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)" '${pidFile}'`;
    await writeConfig({ full: [`sh -c "${grandchild.replace(/"/g, '\\"')} & wait"`], full_exclusive: true });
    const child = spawn('node', [resolve(ws, 'sdd/scripts/sdd-verify.mjs'), 'demo-api', 'full'], {
      cwd: ws,
      env: { ...process.env, SDD_VERIFY_LOCK_DIR: lockDir },
      stdio: 'ignore',
    });
    const closed = new Promise((done) => child.on('close', done));
    for (let attempts = 0; attempts < 200 && !existsSync(pidFile); attempts++) await new Promise((r) => setTimeout(r, 50));
    expect(existsSync(pidFile)).toBe(true);
    const grandchildPid = Number(readFileSync(pidFile, 'utf-8'));
    expect(() => process.kill(grandchildPid, 0)).not.toThrow();
    child.kill('SIGTERM');
    await closed;
    for (let attempts = 0; attempts < 100; attempts++) {
      try {
        process.kill(grandchildPid, 0);
      } catch {
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(() => process.kill(grandchildPid, 0)).toThrow();
    expect(existsSync(join(lockDir, 'verify-full.lock'))).toBe(false);
  });

  it('works outside a git repo: no commit, never reuses, no crash', async () => {
    const bare = mkdtempSync(resolve(tmpdir(), 'harness verify nogit '));
    try {
      await generateSDD(bare, {
        projectName: 'nogit', description: 'x', packageScope: '@n', apps: [{ name: 'demo-api', type: 'nestjs' }], libs: [], services: [], sddProfile: 'solo',
      }, { mergePackageJson: true });
      await fs.writeJSON(resolve(bare, 'sdd/verify.json'), { 'apps/demo-api': { full: ['node -e "0"'] } });
      const run = spawnSync('node', [resolve(bare, 'sdd/scripts/sdd-verify.mjs'), 'demo-api', 'full', '--reuse', '--json'], { encoding: 'utf-8', cwd: bare });
      expect(run.status).toBe(0);
      const parsed = JSON.parse(run.stdout) as VerifyResult;
      expect(parsed.commit).toBeNull();
      expect(parsed.dirty).toEqual([]);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });

  it('--init seeds nx-style entries and never overwrites an existing one', async () => {
    const nxWs = mkdtempSync(resolve(tmpdir(), 'harness verify nx '));
    try {
      await generateSDD(nxWs, {
        projectName: 'nxp', description: 'x', packageScope: '@n', apps: [{ name: 'demo-api', type: 'nestjs' }], libs: [], services: [], sddProfile: 'solo',
      }, { mergePackageJson: true });
      writeFileSync(join(nxWs, 'nx.json'), '{}');
      await fs.ensureDir(join(nxWs, 'apps/demo-api'));
      await fs.writeJSON(join(nxWs, 'apps/demo-api/project.json'), { name: 'demo-api', targets: { test: {}, build: {} } });
      const script = resolve(nxWs, 'sdd/scripts/sdd-verify.mjs');
      const globalFile = resolve(nxWs, 'sdd/global.json');
      const globalDoc = await fs.readJSON(globalFile);
      globalDoc.monorepo.tools = { ghost: 'tools/ghost — tool' };
      await fs.writeJSON(globalFile, globalDoc);
      const first = spawnSync('node', [script, '--init'], { encoding: 'utf-8', cwd: nxWs });
      expect(first.status).toBe(0);
      expect(first.stdout).toContain('– tools/ghost: not an nx project yet (no project.json or package.json) — run pnpm sdd:verify --init again once it has code');
      const seeded = await fs.readJSON(resolve(nxWs, 'sdd/verify.json'));
      expect(seeded['apps/demo-api']).toEqual({
        quick: ['pnpm nx run-many -t lint test -p demo-api'],
        full: ['pnpm nx run-many -t lint test build -p demo-api'],
        full_exclusive: true,
      });
      expect(seeded['tools/ghost']).toBeUndefined();
      seeded['apps/demo-api'].quick = ['custom'];
      await fs.writeJSON(resolve(nxWs, 'sdd/verify.json'), seeded);
      spawnSync('node', [script, '--init'], { encoding: 'utf-8', cwd: nxWs });
      expect((await fs.readJSON(resolve(nxWs, 'sdd/verify.json')))['apps/demo-api'].quick).toEqual(['custom']);
    } finally {
      rmSync(nxWs, { recursive: true, force: true });
    }
  });

  it('--init infers package.json scripts for a non-nx repo', async () => {
    const pkgWs = mkdtempSync(resolve(tmpdir(), 'harness verify pkg '));
    try {
      await generateSDD(pkgWs, {
        projectName: 'pkgp', description: 'x', packageScope: '@n', apps: [{ name: 'demo-api', type: 'nestjs' }], libs: [], services: [], sddProfile: 'solo',
      }, { mergePackageJson: true });
      await fs.ensureDir(join(pkgWs, 'apps/demo-api'));
      await fs.writeJSON(join(pkgWs, 'apps/demo-api/package.json'), { name: '@n/demo-api', scripts: { test: 'x', build: 'y', lint: 'z' } });
      const run = spawnSync('node', [resolve(pkgWs, 'sdd/scripts/sdd-verify.mjs'), '--init'], { encoding: 'utf-8', cwd: pkgWs });
      expect(run.status).toBe(0);
      const seeded = await fs.readJSON(resolve(pkgWs, 'sdd/verify.json'));
      expect(seeded['apps/demo-api'].quick).toEqual(['pnpm --filter @n/demo-api run lint', 'pnpm --filter @n/demo-api run test']);
      expect(seeded['apps/demo-api'].full).toContain('pnpm --filter @n/demo-api run build');
    } finally {
      rmSync(pkgWs, { recursive: true, force: true });
    }
  });

  it('--init skips subprojects with no usable scripts and standalone libs without their own directory', async () => {
    const pkgWs = mkdtempSync(resolve(tmpdir(), 'harness verify skip '));
    try {
      await generateSDD(pkgWs, {
        projectName: 'skipp', description: 'x', packageScope: '@n', apps: [{ name: 'demo-api', type: 'nestjs' }], libs: [], services: [], sddProfile: 'solo',
      }, { mergePackageJson: true });
      const globalFile = resolve(pkgWs, 'sdd/global.json');
      const globalDoc = await fs.readJSON(globalFile);
      globalDoc.monorepo.tool = 'none (standalone repo)';
      globalDoc.monorepo.libs = { shared: 'libs/shared — lib' };
      await fs.writeJSON(globalFile, globalDoc);
      await fs.writeJSON(join(pkgWs, 'package.json'), { name: 'root', scripts: { test: 'x' } });
      const run = spawnSync('node', [resolve(pkgWs, 'sdd/scripts/sdd-verify.mjs'), '--init'], { encoding: 'utf-8', cwd: pkgWs });
      const seeded = await fs.readJSON(resolve(pkgWs, 'sdd/verify.json'));
      expect(seeded['apps/demo-api']).toEqual({ quick: ['pnpm run test'], full: ['pnpm run test'] });
      expect(seeded['libs/shared']).toBeUndefined();
      expect(run.stdout).toContain('– libs/shared: no directory of its own in a standalone repo');
      await fs.ensureDir(join(pkgWs, 'libs/shared'));
      await fs.writeJSON(join(pkgWs, 'libs/shared/package.json'), { name: '@n/shared', scripts: { start: 'x' } });
      const again = spawnSync('node', [resolve(pkgWs, 'sdd/scripts/sdd-verify.mjs'), '--init'], { encoding: 'utf-8', cwd: pkgWs });
      expect(again.stdout).toContain('– libs/shared: no lint, typecheck, test or build script in its package.json');
    } finally {
      rmSync(pkgWs, { recursive: true, force: true });
    }
  });
});
