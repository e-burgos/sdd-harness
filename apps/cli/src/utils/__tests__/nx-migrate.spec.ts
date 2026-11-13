import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Step = { step: string; command: string; args: string[] };
type Lib = {
  parseMajor(range: string): number | null;
  detectNxMajor(pkg: unknown): number | null;
  detectPackageManager(root: string): string;
  highestVersion(versions: string | string[]): string | null;
  planHops(current: number, target: number): number[];
  hopCommands(input: { pm: string; version: string; hasMigrations: boolean }): Step[];
  executeHops(input: {
    root: string;
    hops: number[];
    pm: string;
    resolveVersion: (major: number) => string | null;
    run: (step: Step, cwd: string) => boolean | { ok: boolean; output: string };
    fileExists: (path: string) => boolean;
    removeFile: (path: string) => void;
    prepareBranch?: (target: number) => { ok: boolean; branch?: string };
    readInstalledMajor?: (root: string) => number | null;
    listPending?: (root: string) => string[];
  }): { ok: boolean; completed: { major: number; version: string }[]; failed?: { major: number; step: string; reason?: string }; pendingPrompts?: string[]; branch?: { branch?: string } | null };
  prepareMigrationBranch(input: { git: (args: string[]) => { status: number | null; stdout: string }; target: number }): { ok: boolean; branch?: string; created?: boolean; switched?: boolean };
  gitRunner(root: string): (args: string[]) => { status: number | null; stdout: string };
  listPendingPrompts(root: string): string[];
};

const repoRoot = resolve(__dirname, '../../../../..');
const kitRoot = join(repoRoot, 'apps/cli/templates/sdd');
const script = join(kitRoot, 'scripts/sdd-nx-migrate.mjs');
let lib: Lib;

beforeAll(async () => {
  lib = (await import(pathToFileURL(join(kitRoot, 'scripts/lib/nx-migrate.mjs')).href)) as Lib;
});

function workspace(pkg: unknown, lock?: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'nxm-'));
  mkdirSyncSdd(dir);
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
  if (lock) writeFileSync(join(dir, lock), '');
  return dir;
}

function mkdirSyncSdd(dir: string) {
  execFileSync('mkdir', ['-p', join(dir, 'sdd/scripts/lib')]);
  execFileSync('cp', [script, join(dir, 'sdd/scripts/')]);
  execFileSync('cp', [join(kitRoot, 'scripts/lib/nx-migrate.mjs'), join(dir, 'sdd/scripts/lib/')]);
}

function runScript(dir: string, args: string[]) {
  try {
    const stdout = execFileSync('node', [join(dir, 'sdd/scripts/sdd-nx-migrate.mjs'), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, stdout: err.stdout, stderr: err.stderr };
  }
}

function listFiles(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full, base) : [full.slice(base.length + 1)];
  });
}

describe('nx-migrate lib', () => {
  it('parses majors from ranges', () => {
    expect(lib.parseMajor('^22.7.12')).toBe(22);
    expect(lib.parseMajor('~24.0.6')).toBe(24);
    expect(lib.parseMajor('23.3.2')).toBe(23);
    expect(lib.parseMajor('latest')).toBeNull();
  });

  it('detects the nx major from dependencies or devDependencies', () => {
    expect(lib.detectNxMajor({ devDependencies: { nx: '22.7.12' } })).toBe(22);
    expect(lib.detectNxMajor({ dependencies: { nx: '^23.0.0' } })).toBe(23);
    expect(lib.detectNxMajor({ devDependencies: {} })).toBeNull();
    expect(lib.detectNxMajor(null)).toBeNull();
  });

  it('plans one hop per major and never skips', () => {
    expect(lib.planHops(22, 24)).toEqual([23, 24]);
    expect(lib.planHops(23, 24)).toEqual([24]);
    expect(lib.planHops(24, 24)).toEqual([]);
    expect(lib.planHops(24, 22)).toEqual([]);
    expect(lib.planHops(null as unknown as number, 24)).toEqual([]);
  });

  it('picks the highest stable version', () => {
    expect(lib.highestVersion(['24.0.1', '24.0.10', '24.0.2', '24.1.0-beta.1'])).toBe('24.0.10');
    expect(lib.highestVersion('23.3.2')).toBe('23.3.2');
    expect(lib.highestVersion([])).toBeNull();
  });

  it('detects the package manager from the lockfile', () => {
    expect(lib.detectPackageManager(workspace({}, 'pnpm-lock.yaml'))).toBe('pnpm');
    expect(lib.detectPackageManager(workspace({}, 'yarn.lock'))).toBe('yarn');
    expect(lib.detectPackageManager(workspace({}, 'package-lock.json'))).toBe('npm');
    expect(lib.detectPackageManager(workspace({}))).toBe('pnpm');
  });

  it('builds hop commands with migrations only when present', () => {
    const base = lib.hopCommands({ pm: 'pnpm', version: '23.3.2', hasMigrations: false }).map((s) => s.step);
    expect(base).toEqual(['migrate', 'install']);
    const full = lib.hopCommands({ pm: 'npm', version: '23.3.2', hasMigrations: true });
    expect(full.map((s) => s.step)).toEqual(['migrate', 'install', 'run-migrations']);
    expect(full[0].args).toEqual(['nx', 'migrate', '23.3.2']);
    expect(full[1].command).toBe('npm');
  });

  it('stops at the first failing step and reports it', () => {
    const calls: string[] = [];
    const result = lib.executeHops({
      root: '/r',
      hops: [23, 24],
      pm: 'pnpm',
      resolveVersion: (m) => `${m}.0.0`,
      run: (step) => {
        calls.push(`${step.step}`);
        return step.step !== 'install';
      },
      fileExists: () => false,
      removeFile: () => undefined,
    });
    expect(result.ok).toBe(false);
    expect(result.failed).toMatchObject({ major: 23, step: 'install' });
    expect(result.completed).toEqual([]);
    expect(calls).toEqual(['migrate', 'install']);
  });

  it('runs migrations and removes migrations.json when it appears', () => {
    const removed: string[] = [];
    const steps: string[] = [];
    const result = lib.executeHops({
      root: '/r',
      hops: [23],
      pm: 'pnpm',
      resolveVersion: () => '23.3.2',
      run: (step) => (steps.push(step.step), true),
      fileExists: (p) => p.endsWith('migrations.json'),
      removeFile: (p) => removed.push(p),
    });
    expect(result.ok).toBe(true);
    expect(steps).toEqual(['migrate', 'install', 'run-migrations']);
    expect(removed).toEqual(['/r/migrations.json']);
    expect(result.completed).toEqual([{ major: 23, version: '23.3.2' }]);
  });
});

function gitRepo(branch: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'nxm-git-'));
  const git = (...a: string[]) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  git('init', '-q', '-b', branch);
  git('config', 'user.email', 't@t.t');
  git('config', 'user.name', 't');
  writeFileSync(join(dir, 'a.txt'), 'a');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  return dir;
}

describe('nx-migrate hardening', () => {
  it('creates chore/nx-<target> when on the default branch and leaves other branches alone', () => {
    const dir = gitRepo('main');
    const first = lib.prepareMigrationBranch({ git: lib.gitRunner(dir), target: 24 });
    expect(first).toMatchObject({ ok: true, branch: 'chore/nx-24', created: true, switched: true });
    expect(execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim()).toBe('chore/nx-24');
    const again = lib.prepareMigrationBranch({ git: lib.gitRunner(dir), target: 24 });
    expect(again).toMatchObject({ ok: true, branch: 'chore/nx-24', switched: false });
  });

  it('switches to an existing migration branch from master', () => {
    const dir = gitRepo('master');
    execFileSync('git', ['branch', 'chore/nx-24'], { cwd: dir });
    expect(lib.prepareMigrationBranch({ git: lib.gitRunner(dir), target: 24 })).toMatchObject({ ok: true, branch: 'chore/nx-24', created: false, switched: true });
  });

  it('treats the remote HEAD branch as default', () => {
    const dir = gitRepo('develop');
    const git = (args: string[]) => (args[0] === 'symbolic-ref' ? { status: 0, stdout: 'origin/develop' } : lib.gitRunner(dir)(args));
    expect(lib.prepareMigrationBranch({ git, target: 24 })).toMatchObject({ branch: 'chore/nx-24', created: true });
  });

  function exec(output: string, ok = true, extra: Partial<Parameters<Lib['executeHops']>[0]> = {}) {
    const calls: Step[] = [];
    const removed: string[] = [];
    const result = lib.executeHops({
      root: '/r',
      hops: [24],
      pm: 'pnpm',
      resolveVersion: () => '24.0.6',
      run: (step) => {
        calls.push(step);
        return step.step === 'run-migrations' ? { ok, output } : { ok: true, output: '' };
      },
      fileExists: (p) => p.endsWith('migrations.json'),
      removeFile: (p) => removed.push(p),
      readInstalledMajor: () => 24,
      listPending: () => [],
      ...extra,
    });
    return { result, calls, removed };
  }

  it('fails and keeps migrations.json when nx refuses to start the run', () => {
    const { result, removed } = exec('NX  Not starting the run: you are on the default branch', true);
    expect(result.ok).toBe(false);
    expect(result.failed).toMatchObject({ major: 24, step: 'run-migrations' });
    expect(result.failed?.reason).toContain('migrations.json was kept');
    expect(removed).toEqual([]);
    expect(result.completed).toEqual([]);
  });

  it('fails and keeps migrations.json on a non-zero exit', () => {
    const { result, removed } = exec('boom', false);
    expect(result.ok).toBe(false);
    expect(removed).toEqual([]);
  });

  it('deletes migrations.json on success and reports pending prompts', () => {
    const prompts = ['tools/ai-migrations/@nx/jest/24.0.6/finish-inferred-conversion.md'];
    const { result, removed } = exec('ran 13 migrations', true, { listPending: () => prompts });
    expect(result.ok).toBe(true);
    expect(removed).toEqual(['/r/migrations.json']);
    expect(result.pendingPrompts).toEqual(prompts);
  });

  it('passes --no-agentic only when the installed nx is >= 24', () => {
    const flag = (installed: number | null) => exec('ok', true, { readInstalledMajor: () => installed }).calls.find((c) => c.step === 'run-migrations')?.args;
    expect(flag(24)).toEqual(['nx', 'migrate', '--run-migrations', '--no-agentic']);
    expect(flag(23)).toEqual(['nx', 'migrate', '--run-migrations']);
    expect(flag(22)).toEqual(['nx', 'migrate', '--run-migrations']);
    const hop = lib.hopCommands({ pm: 'pnpm', version: '24.0.6', hasMigrations: true });
    expect(hop[2].args).toEqual(['nx', 'migrate', '--run-migrations']);
  });

  it('prepares the branch for the last hop and stops if it cannot', () => {
    const targets: number[] = [];
    const ok = exec('ok', true, { hops: [23, 24], prepareBranch: (t) => (targets.push(t), { ok: true, branch: 'chore/nx-24' }) });
    expect(targets).toEqual([24]);
    expect(ok.result.branch).toMatchObject({ branch: 'chore/nx-24' });
    const bad = exec('ok', true, { prepareBranch: () => ({ ok: false }) });
    expect(bad.result.ok).toBe(false);
    expect(bad.result.failed?.step).toBe('branch');
    expect(bad.calls).toEqual([]);
  });

  it('lists deferred prompts under tools/ai-migrations in order', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nxm-prompts-'));
    expect(lib.listPendingPrompts(dir)).toEqual([]);
    const nested = join(dir, 'tools/ai-migrations/@nx/vite/24.0.6');
    execFileSync('mkdir', ['-p', nested, join(dir, 'tools/ai-migrations/@nx/jest/24.0.6')]);
    writeFileSync(join(nested, 'b.md'), '');
    writeFileSync(join(dir, 'tools/ai-migrations/@nx/jest/24.0.6/a.md'), '');
    expect(lib.listPendingPrompts(dir)).toEqual(['tools/ai-migrations/@nx/jest/24.0.6/a.md', 'tools/ai-migrations/@nx/vite/24.0.6/b.md']);
  });
});

describe('sdd-nx-migrate command', () => {
  it('exits 2 without nx or without --to', () => {
    expect(runScript(workspace({ devDependencies: {} }), ['--to', '24']).code).toBe(2);
    expect(runScript(workspace({ devDependencies: { nx: '22.7.12' } }), []).code).toBe(2);
  });

  it('does nothing when the target is not above the current major', () => {
    const r = runScript(workspace({ devDependencies: { nx: '24.0.6' } }), ['--to', '24', '--json']);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout).hops).toEqual([]);
  });

  it('prints the plan without --yes', () => {
    const r = runScript(workspace({ devDependencies: { nx: '22.7.12' } }, 'pnpm-lock.yaml'), ['--to', '24', '--json']);
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.executed).toBe(false);
    expect(out.hops.map((h: { major: number }) => h.major)).toEqual([23, 24]);
    expect(out.hops[0].steps[0]).toBe('npx nx migrate <latest 23.x>');
    expect(out.pm).toBe('pnpm');
  });

  it('refuses --yes on a dirty git tree', () => {
    const dir = workspace({ devDependencies: { nx: '22.7.12' } });
    execFileSync('git', ['init', '-q'], { cwd: dir });
    const r = runScript(dir, ['--to', '23', '--yes']);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('dirty');
  });
});

describe('nx-migration skill', () => {
  const files = ['SKILL.md', 'references/22-to-23.md', 'references/23-to-24.md', 'references/typescript-7.md'];

  it('ships the skill with its references and frontmatter', () => {
    for (const f of files) expect(existsSync(join(kitRoot, 'skills/nx-migration', f))).toBe(true);
    expect(readFileSync(join(kitRoot, 'skills/nx-migration/SKILL.md'), 'utf8')).toMatch(/^---\nname: nx-migration\ndescription: .+\n---/);
  });

  it('is mirrored byte-identical in the repo sdd', () => {
    const pairs = [
      ...listFiles(join(kitRoot, 'skills/nx-migration')).map((f) => `skills/nx-migration/${f}`),
      'scripts/sdd-nx-migrate.mjs',
      'scripts/lib/nx-migrate.mjs',
    ];
    for (const rel of pairs) {
      expect(readFileSync(join(repoRoot, 'sdd', rel)).equals(readFileSync(join(kitRoot, rel)))).toBe(true);
    }
  });

  it('is listed in both documentation READMEs', () => {
    for (const lang of ['es', 'en']) {
      const text = readFileSync(join(kitRoot, `documentation/${lang}/README.md`), 'utf8');
      expect(text).toContain('nx-migration/');
      expect(text).toContain('| `nx-migration`');
    }
  });
});
