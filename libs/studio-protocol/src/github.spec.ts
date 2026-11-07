import { describe, expect, it } from 'vitest';
import { ClientCommand, CycleGithub, GithubConnectResult, GithubStatus, MAX_GITHUB_CYCLES, WorkspaceSnapshot } from './index';

const remote = { url: 'https://github.com/e-burgos/demo', owner: 'e-burgos', name: 'demo' };
const cycleGithub = {
  specId: 'spec-e-burgos-014-x',
  cycle: 'cycle-02',
  branch: 'feat/x-cycle-02',
  pr: { number: 1, url: 'https://github.com/e-burgos/demo/pull/1', state: 'OPEN', isDraft: false },
  checks: 'success',
};
const snapshotBase = {
  project: 'p', profile: 'solo', kitVersion: null, specs: [], cycles: [], fixes: [], agents: [], skills: [],
  gateMode: 'block', pricing: null, stale: [],
};

describe('github commands', () => {
  it('parses github.status with and without generationId', () => {
    expect(ClientCommand.parse({ kind: 'command', id: '1', cmd: 'github.status' })).toMatchObject({ cmd: 'github.status' });
    expect(ClientCommand.parse({ kind: 'command', id: '1', cmd: 'github.status', generationId: 'g1' })).toMatchObject({ generationId: 'g1' });
    expect(ClientCommand.safeParse({ kind: 'command', id: '1', cmd: 'github.status', generationId: '' }).success).toBe(false);
  });

  it('parses github.connect and rejects bad names and visibility', () => {
    const base = { kind: 'command', id: '1', cmd: 'github.connect', visibility: 'private', protect: false };
    expect(ClientCommand.parse({ ...base, name: 'my-repo_1.x', owner: 'e-burgos', generationId: 'g1' })).toMatchObject({ visibility: 'private' });
    expect(ClientCommand.safeParse(base).success).toBe(true);
    expect(ClientCommand.safeParse({ ...base, name: 'a/b' }).success).toBe(false);
    expect(ClientCommand.safeParse({ ...base, owner: '' }).success).toBe(false);
    expect(ClientCommand.safeParse({ ...base, name: 'x'.repeat(101) }).success).toBe(false);
    expect(ClientCommand.safeParse({ ...base, visibility: 'internal' }).success).toBe(false);
    const { protect: _protect, ...withoutProtect } = base;
    expect(ClientCommand.safeParse(withoutProtect).success).toBe(false);
  });
});

describe('github results', () => {
  it('parses a status', () => {
    const status = { gh: { installed: true, authenticated: true, user: 'e-burgos' }, git: { repo: true, branch: 'main', hasCommits: true }, remote, workflow: true };
    expect(GithubStatus.parse(status)).toEqual(status);
    expect(GithubStatus.safeParse({ ...status, workflow: 'yes' }).success).toBe(false);
  });

  it('parses a connect result and caps the error', () => {
    expect(GithubConnectResult.parse({ ok: true, remote, protected: false, error: null }).ok).toBe(true);
    expect(GithubConnectResult.parse({ ok: false, remote: null, protected: false, error: 'boom' }).error).toBe('boom');
    expect(GithubConnectResult.safeParse({ ok: false, remote: null, protected: false, error: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('parses a cycle with and without PR and rejects bad values', () => {
    expect(CycleGithub.parse(cycleGithub).checks).toBe('success');
    expect(CycleGithub.parse({ ...cycleGithub, pr: null, checks: 'none' }).pr).toBeNull();
    expect(CycleGithub.safeParse({ ...cycleGithub, cycle: 'c2' }).success).toBe(false);
    expect(CycleGithub.safeParse({ ...cycleGithub, checks: 'green' }).success).toBe(false);
    expect(CycleGithub.safeParse({ ...cycleGithub, pr: { ...cycleGithub.pr, number: 0 } }).success).toBe(false);
    expect(CycleGithub.safeParse({ ...cycleGithub, pr: { ...cycleGithub.pr, state: 'DRAFT' } }).success).toBe(false);
  });
});

describe('snapshot.github', () => {
  it('accepts a valid github block', () => {
    const github = { remote, cycles: [cycleGithub] };
    expect(WorkspaceSnapshot.parse({ ...snapshotBase, github }).github).toEqual(github);
  });

  it('is optional', () => {
    expect(WorkspaceSnapshot.parse(snapshotBase).github).toBeUndefined();
  });

  it('drops a malformed or over-cap block to undefined without failing the snapshot', () => {
    expect(WorkspaceSnapshot.parse({ ...snapshotBase, github: { remote: 'x', cycles: 3 } }).github).toBeUndefined();
    const over = { remote: null, cycles: Array.from({ length: MAX_GITHUB_CYCLES + 1 }, () => cycleGithub) };
    expect(WorkspaceSnapshot.parse({ ...snapshotBase, github: over }).github).toBeUndefined();
    const atCap = { remote: null, cycles: Array.from({ length: MAX_GITHUB_CYCLES }, () => cycleGithub) };
    expect(WorkspaceSnapshot.parse({ ...snapshotBase, github: atCap }).github?.cycles).toHaveLength(MAX_GITHUB_CYCLES);
  });
});
