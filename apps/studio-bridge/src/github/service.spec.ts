import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecResult } from './exec';
import { connectArgs, GithubService, isGithubCommand, type GithubHost } from './service';

const ok = (stdout: string): ExecResult => ({ code: 0, stdout, stderr: '', timedOut: false, missing: false });
const status = {
  gh: { installed: true, authenticated: true, user: 'octo' },
  git: { repo: true, branch: 'main', hasCommits: true },
  remote: null,
  workflow: false,
};
const cli = { bin: '/cli/harness.mjs', version: '1.0.0' };
const request = { visibility: 'private', protect: false } as const;

let target: string;
beforeEach(async () => {
  target = await mkdtemp(path.join(tmpdir(), 'gh-svc-'));
  await mkdir(path.join(target, 'sdd'));
});
afterEach(() => rm(target, { recursive: true, force: true }));

function build(opts: { exec: ReturnType<typeof vi.fn>; runtime?: boolean; generation?: { status: string; target: string } | null }) {
  const refreshGithub = vi.fn(async () => undefined);
  const host: GithubHost = {
    generations: { find: () => (opts.generation === undefined ? undefined : opts.generation) as never },
    runtime: opts.runtime === false ? null : { root: '/open/root', refreshGithub },
  };
  return { service: new GithubService(host, { cli, exec: opts.exec as never, env: () => ({}) }), refreshGithub };
}

describe('GithubService', () => {
  it('recognises its commands', () => {
    expect(isGithubCommand({ cmd: 'github.status' } as never)).toBe(true);
    expect(isGithubCommand({ cmd: 'wizard.catalog' } as never)).toBe(false);
  });

  it('runs status on the opened project with the CLI through node', async () => {
    const exec = vi.fn(async () => ok(JSON.stringify(status)));
    const { service } = build({ exec });
    expect(await service.handle({ kind: 'command', id: '1', cmd: 'github.status' })).toEqual(status);
    expect(exec).toHaveBeenCalledWith(process.execPath, ['/cli/harness.mjs', 'github', 'status', '--dir', '/open/root', '--json'], expect.objectContaining({ timeoutMs: 20_000 }));
  });

  it('rejects status without a project in launcher mode', async () => {
    const { service } = build({ exec: vi.fn(), runtime: false });
    await expect(service.handle({ kind: 'command', id: '1', cmd: 'github.status' })).rejects.toThrow('no project open');
  });

  it('resolves a succeeded generation and rejects the others', async () => {
    const exec = vi.fn(async (..._call: unknown[]) => ok(JSON.stringify(status)));
    const good = build({ exec, generation: { status: 'succeeded', target } });
    await good.service.handle({ kind: 'command', id: '1', cmd: 'github.status', generationId: 'g1' });
    expect(exec.mock.calls[0]![1]).toContain(target);
    await expect(build({ exec, generation: null }).service.handle({ kind: 'command', id: '1', cmd: 'github.status', generationId: 'g1' })).rejects.toThrow('unknown generation');
    await expect(build({ exec, generation: { status: 'running', target } }).service.handle({ kind: 'command', id: '1', cmd: 'github.status', generationId: 'g1' })).rejects.toThrow('did not finish');
    await expect(build({ exec, generation: { status: 'gate-failed', target } }).service.handle({ kind: 'command', id: '1', cmd: 'github.connect', generationId: 'g1', ...request })).rejects.toThrow('did not finish');
  });

  it('fails status on unusable output', async () => {
    const { service } = build({ exec: vi.fn(async () => ({ ...ok('nope'), code: 1, stderr: 'boom' })) });
    await expect(service.handle({ kind: 'command', id: '1', cmd: 'github.status' })).rejects.toThrow('boom');
  });

  it('builds the exact connect argv', () => {
    expect(connectArgs('/t', request)).toEqual(['github', 'connect', '--dir', '/t', '--yes', '--json']);
    expect(connectArgs('/t', { name: 'repo', owner: 'org', visibility: 'public', protect: true })).toEqual([
      'github', 'connect', '--dir', '/t', '--name', 'repo', '--owner', 'org', '--public', '--protect', '--yes', '--json',
    ]);
  });

  it('connects the opened project and refreshes the PR feed', async () => {
    const remote = { url: 'https://github.com/o/r.git', owner: 'o', name: 'r' };
    const exec = vi.fn(async () => ok(JSON.stringify({ ok: true, remote, protected: true })));
    const { service, refreshGithub } = build({ exec });
    const result = await service.handle({ kind: 'command', id: '1', cmd: 'github.connect', ...request });
    expect(result).toEqual({ ok: true, remote, protected: true, error: null });
    expect(exec).toHaveBeenCalledWith(process.execPath, ['/cli/harness.mjs', ...connectArgs('/open/root', request)], expect.objectContaining({ timeoutMs: 180_000 }));
    expect(refreshGithub).toHaveBeenCalledTimes(1);
  });

  it('does not refresh the open project feed when connecting a generation', async () => {
    const exec = vi.fn(async () => ok(JSON.stringify({ ok: true, remote: null, protected: false })));
    const { service, refreshGithub } = build({ exec, generation: { status: 'succeeded', target } });
    await service.handle({ kind: 'command', id: '1', cmd: 'github.connect', generationId: 'g1', ...request });
    expect(refreshGithub).not.toHaveBeenCalled();
  });

  it('returns the CLI error message', async () => {
    const exec = vi.fn(async () => ({ ...ok(JSON.stringify({ ok: false, error: { code: 'no-gh', message: 'gh is missing' } })), code: 1 }));
    const { service, refreshGithub } = build({ exec });
    expect(await service.handle({ kind: 'command', id: '1', cmd: 'github.connect', ...request })).toEqual({ ok: false, remote: null, protected: false, error: 'gh is missing' });
    expect(refreshGithub).not.toHaveBeenCalled();
  });

  it('reports non-JSON output and timeouts as failed results', async () => {
    const garbled = build({ exec: vi.fn(async () => ({ ...ok('<html>'), code: 1, stderr: 'crashed' })) });
    expect(await garbled.service.handle({ kind: 'command', id: '1', cmd: 'github.connect', ...request })).toMatchObject({ ok: false, error: 'crashed' });
    const slow = build({ exec: vi.fn(async () => ({ ...ok(''), code: null, timedOut: true })) });
    expect(await slow.service.handle({ kind: 'command', id: '1', cmd: 'github.connect', ...request })).toMatchObject({ ok: false, remote: null, protected: false });
  });
});
