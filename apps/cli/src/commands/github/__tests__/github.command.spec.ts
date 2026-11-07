import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runCommand } from 'citty';
import { githubCommand } from '../index.js';
import { setGithubRunner, type Runner } from '../../../utils/github.js';

interface World {
  ghInstalled: boolean;
  ghAuthed: boolean;
  repo: boolean;
  commits: boolean;
  origin: string | null;
  createFails: boolean;
}

function fakeWorld(overrides: Partial<World> = {}) {
  const world: World = {
    ghInstalled: true,
    ghAuthed: true,
    repo: true,
    commits: true,
    origin: null,
    createFails: false,
    ...overrides,
  };
  const calls: { cmd: string; args: string[]; input?: string }[] = [];
  const runner: Runner = async (cmd, args, opts) => {
    calls.push({ cmd, args, input: opts.input });
    const ok = (stdout = '') => ({ code: 0, stdout, stderr: '' });
    const bad = (stderr = 'boom', code = 1) => ({ code, stdout: '', stderr });
    const line = `${cmd} ${args.join(' ')}`;
    if (cmd === 'gh') {
      if (line === 'gh --version') return world.ghInstalled ? ok('gh 2') : bad('', 127);
      if (line === 'gh auth status') return world.ghAuthed ? ok() : bad('not logged in');
      if (line === 'gh api user --jq .login') return ok('octo\n');
      if (args[0] === 'repo' && args[1] === 'create') {
        if (world.createFails) return bad('name already exists');
        world.origin = `https://github.com/octo/${args[2].split('/').pop()}.git`;
        return ok();
      }
      return ok();
    }
    if (line === 'git rev-parse --is-inside-work-tree') return world.repo ? ok('true\n') : bad('', 128);
    if (line === 'git symbolic-ref --short HEAD') return world.repo ? ok('main\n') : bad();
    if (line === 'git rev-parse --verify HEAD') return world.commits ? ok('abc') : bad('', 128);
    if (line === 'git remote get-url origin') return world.origin ? ok(`${world.origin}\n`) : bad('', 2);
    if (line === 'git init') {
      world.repo = true;
      return ok();
    }
    if (args[0] === 'commit') {
      world.commits = true;
      return ok();
    }
    return ok();
  };
  return { world, calls, runner };
}

describe('harness github', () => {
  let dir: string;
  let out: string;
  let err: string;

  const run = (...rawArgs: string[]) => runCommand(githubCommand, { rawArgs: [...rawArgs, '--dir', dir] });
  const json = () => JSON.parse(out) as Record<string, unknown>;
  const installTemplate = () => {
    mkdirSync(resolve(dir, 'sdd/templates/github/workflows'), { recursive: true });
    writeFileSync(resolve(dir, 'sdd/templates/github/workflows/sdd-validate.yml'), 'name: sdd\n');
  };

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), 'harness-github-'));
    out = '';
    err = '';
    process.exitCode = undefined;
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      out += String(chunk);
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      err += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    setGithubRunner(null);
    process.exitCode = undefined;
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it('status --json reports gh, git, remote and workflow', async () => {
    const { runner } = fakeWorld({ origin: 'git@github.com:acme/shop.git' });
    setGithubRunner(runner);
    await run('status', '--json');
    expect(json()).toEqual({
      gh: { installed: true, authenticated: true, user: 'octo' },
      git: { repo: true, branch: 'main', hasCommits: true },
      remote: { url: 'git@github.com:acme/shop.git', owner: 'acme', name: 'shop' },
      workflow: false,
    });
    expect(process.exitCode).toBeUndefined();
  });

  it('connect reports an existing origin and changes nothing', async () => {
    const { runner, calls } = fakeWorld({ origin: 'https://github.com/acme/shop.git' });
    setGithubRunner(runner);
    await run('connect', '--json', '--yes');
    expect(json()).toMatchObject({
      ok: true,
      alreadyConnected: true,
      remote: { owner: 'acme', name: 'shop' },
    });
    expect(calls.some((c) => c.args[0] === 'repo')).toBe(false);
  });

  it('connect fails with guidance when gh is missing', async () => {
    const { runner } = fakeWorld({ ghInstalled: false });
    setGithubRunner(runner);
    await run('connect', '--yes');
    expect(process.exitCode).toBe(1);
    expect(err).toContain('brew install gh');
  });

  it('connect fails with guidance when gh is not authenticated', async () => {
    const { runner } = fakeWorld({ ghAuthed: false });
    setGithubRunner(runner);
    await run('connect', '--yes');
    expect(process.exitCode).toBe(1);
    expect(err).toContain('gh auth login');
  });

  it('connect without --yes in json mode only prints the plan', async () => {
    installTemplate();
    const { runner, calls } = fakeWorld();
    setGithubRunner(runner);
    await run('connect', '--json', '--name', 'shop');
    const result = json();
    expect(result).toMatchObject({
      ok: false,
      needsConfirmation: true,
      plan: { name: 'shop', visibility: 'private', owner: 'octo', addWorkflow: true },
    });
    expect(process.exitCode).toBeUndefined();
    expect(calls.some((c) => c.args[0] === 'repo' || c.args[0] === 'commit')).toBe(false);
    expect(existsSync(resolve(dir, '.github/workflows/sdd-validate.yml'))).toBe(false);
  });

  it('connect --yes writes the workflow, commits and creates the repo', async () => {
    installTemplate();
    const { runner, calls } = fakeWorld();
    setGithubRunner(runner);
    await run('connect', '--json', '--yes', '--name', 'shop', '--owner', 'acme', '--public');
    expect(json()).toMatchObject({
      ok: true,
      remote: { url: 'https://github.com/octo/shop.git', name: 'shop' },
      protected: false,
    });
    expect(existsSync(resolve(dir, '.github/workflows/sdd-validate.yml'))).toBe(true);
    const commit = calls.find((c) => c.args[0] === 'commit');
    expect(commit?.args).toEqual(['commit', '-m', 'ci: add SDD validation workflow']);
    const create = calls.find((c) => c.cmd === 'gh' && c.args[0] === 'repo');
    expect(create?.args).toEqual([
      'repo',
      'create',
      'acme/shop',
      '--public',
      '--source',
      '.',
      '--remote',
      'origin',
      '--push',
    ]);
  });

  it('connect --yes --protect protects the branch after creating', async () => {
    installTemplate();
    const { runner, calls } = fakeWorld({ repo: false, commits: false });
    setGithubRunner(runner);
    await run('connect', '--json', '--yes', '--name', 'shop', '--protect');
    expect(json()).toMatchObject({ ok: true, protected: true });
    expect(calls.some((c) => c.cmd === 'git' && c.args[0] === 'init')).toBe(true);
    const protect = calls.find((c) => c.cmd === 'gh' && c.args[0] === 'api' && c.args.includes('PUT'));
    expect(protect?.args[3]).toBe('repos/octo/shop/branches/main/protection');
    expect(JSON.parse(protect?.input ?? '{}').required_status_checks.contexts).toEqual(['sdd:validate']);
  });

  it('connect surfaces the gh error and exits 1', async () => {
    installTemplate();
    const { runner } = fakeWorld({ createFails: true });
    setGithubRunner(runner);
    await run('connect', '--yes', '--name', 'shop');
    expect(process.exitCode).toBe(1);
    expect(err).toContain('name already exists');
  });

  it('protect requires an origin', async () => {
    const { runner } = fakeWorld();
    setGithubRunner(runner);
    await run('protect', '--yes');
    expect(process.exitCode).toBe(1);
    expect(err).toContain('harness github connect');
  });

  it('protect without --yes in json mode prints the plan only', async () => {
    const { runner, calls } = fakeWorld({ origin: 'https://github.com/acme/shop.git' });
    setGithubRunner(runner);
    await run('protect', '--json');
    expect(json()).toMatchObject({
      ok: false,
      needsConfirmation: true,
      plan: { owner: 'acme', name: 'shop', branch: 'main', requiredCheck: 'sdd:validate' },
    });
    expect(calls.some((c) => c.args.includes('PUT'))).toBe(false);
  });

  it('protect --yes --branch applies the protection', async () => {
    const { runner, calls } = fakeWorld({ origin: 'https://github.com/acme/shop.git' });
    setGithubRunner(runner);
    await run('protect', '--yes', '--json', '--branch', 'develop');
    expect(json()).toMatchObject({ ok: true, protected: true });
    const put = calls.find((c) => c.args.includes('PUT'));
    expect(put?.args[3]).toBe('repos/acme/shop/branches/develop/protection');
  });
});
