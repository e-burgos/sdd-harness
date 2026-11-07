import { describe, it, expect } from 'vitest';
import {
  createRepo,
  ghStatus,
  gitStatus,
  parseRemoteUrl,
  protectBranch,
  protectBranchBody,
  REQUIRED_CHECK,
  type Runner,
} from '../github.js';

type Call = { cmd: string; args: string[]; input?: string };

function scripted(responses: Record<string, { code?: number; stdout?: string; stderr?: string }>) {
  const calls: Call[] = [];
  const runner: Runner = async (cmd, args, opts) => {
    calls.push({ cmd, args, input: opts.input });
    const hit = responses[`${cmd} ${args.join(' ')}`];
    return { code: hit?.code ?? 0, stdout: hit?.stdout ?? '', stderr: hit?.stderr ?? '' };
  };
  return { runner, calls };
}

describe('parseRemoteUrl', () => {
  it.each([
    ['https://github.com/acme/shop.git', { owner: 'acme', name: 'shop' }],
    ['https://github.com/acme/shop', { owner: 'acme', name: 'shop' }],
    ['git@github.com:acme/shop.git', { owner: 'acme', name: 'shop' }],
    ['ssh://git@github.com/acme/shop.git', { owner: 'acme', name: 'shop' }],
    ['https://gitlab.com/acme/shop.git', null],
    ['not a url', null],
  ])('%s', (url, expected) => {
    expect(parseRemoteUrl(url)).toEqual(expected);
  });
});

describe('ghStatus', () => {
  it('reports not installed when gh --version fails', async () => {
    const { runner } = scripted({ 'gh --version': { code: 127 } });
    expect(await ghStatus(runner, '/x')).toEqual({ installed: false, authenticated: false, user: null });
  });

  it('reports installed but unauthenticated', async () => {
    const { runner } = scripted({ 'gh auth status': { code: 1 } });
    expect(await ghStatus(runner, '/x')).toEqual({ installed: true, authenticated: false, user: null });
  });

  it('reports the authenticated user', async () => {
    const { runner } = scripted({ 'gh api user --jq .login': { stdout: 'octo\n' } });
    expect(await ghStatus(runner, '/x')).toEqual({ installed: true, authenticated: true, user: 'octo' });
  });
});

describe('gitStatus', () => {
  it('reports a non-repository', async () => {
    const { runner } = scripted({ 'git rev-parse --is-inside-work-tree': { code: 128 } });
    expect(await gitStatus(runner, '/x')).toEqual({
      repo: false,
      branch: null,
      hasCommits: false,
      originUrl: null,
    });
  });

  it('reports branch, commits and origin', async () => {
    const { runner } = scripted({
      'git rev-parse --is-inside-work-tree': { stdout: 'true\n' },
      'git symbolic-ref --short HEAD': { stdout: 'main\n' },
      'git remote get-url origin': { stdout: 'git@github.com:a/b.git\n' },
    });
    expect(await gitStatus(runner, '/x')).toEqual({
      repo: true,
      branch: 'main',
      hasCommits: true,
      originUrl: 'git@github.com:a/b.git',
    });
  });

  it('detects a repository without commits or origin', async () => {
    const { runner } = scripted({
      'git rev-parse --is-inside-work-tree': { stdout: 'true\n' },
      'git symbolic-ref --short HEAD': { stdout: 'main\n' },
      'git rev-parse --verify HEAD': { code: 128 },
      'git remote get-url origin': { code: 2 },
    });
    const status = await gitStatus(runner, '/x');
    expect(status.hasCommits).toBe(false);
    expect(status.originUrl).toBeNull();
  });
});

describe('createRepo / protectBranch argv', () => {
  it('creates a private repo with owner', async () => {
    const { runner, calls } = scripted({});
    await createRepo(runner, { owner: 'acme', name: 'shop', visibility: 'private', cwd: '/x' });
    expect(calls[0]).toMatchObject({
      cmd: 'gh',
      args: ['repo', 'create', 'acme/shop', '--private', '--source', '.', '--remote', 'origin', '--push'],
    });
  });

  it('creates a public repo without owner', async () => {
    const { runner, calls } = scripted({});
    await createRepo(runner, { name: 'shop', visibility: 'public', cwd: '/x' });
    expect(calls[0].args).toEqual([
      'repo',
      'create',
      'shop',
      '--public',
      '--source',
      '.',
      '--remote',
      'origin',
      '--push',
    ]);
  });

  it('protects a branch requiring sdd:validate through stdin', async () => {
    const { runner, calls } = scripted({});
    await protectBranch(runner, { owner: 'acme', name: 'shop', branch: 'main', cwd: '/x' });
    expect(calls[0].args).toEqual(['api', '-X', 'PUT', 'repos/acme/shop/branches/main/protection', '--input', '-']);
    expect(JSON.parse(calls[0].input ?? '')).toEqual({
      required_status_checks: { strict: false, contexts: ['sdd:validate'] },
      enforce_admins: false,
      required_pull_request_reviews: null,
      restrictions: null,
    });
    expect(REQUIRED_CHECK).toBe('sdd:validate');
    expect(protectBranchBody()).toBe(calls[0].input);
  });
});
