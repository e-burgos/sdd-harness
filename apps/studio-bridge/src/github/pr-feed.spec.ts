import type { CycleSummary, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceWatcher } from '../workspace/watcher';
import type { Exec, ExecResult } from './exec';
import { createGithubFeed, parsePrView, reduceChecks, withGithub, type GithubKitLib } from './pr-feed';

const res = (code: number, stdout = ''): ExecResult => ({ code, stdout, stderr: '', timedOut: false, missing: false });
const lib: GithubKitLib = {
  branchNameFor: (specId, cycle) => `feat/${specId.replace(/^spec-x-\d+-/, '')}-${cycle}`,
  parseRemoteUrl: (url) => (url.includes('github.com') ? { owner: 'o', name: 'r' } : null),
};
const cycle = (specId: string, n: string, status = 'in-progress'): CycleSummary =>
  ({ specId, cycle: n, status, flow: 'lite', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0 }) as CycleSummary;
const snap = (cycles: CycleSummary[]): WorkspaceSnapshot =>
  ({ project: 'p', profile: 'solo', kitVersion: null, specs: [], cycles, fixes: [], agents: [], skills: [], gateMode: 'block', pricing: null, stale: [] }) as WorkspaceSnapshot;
const watcherOf = (get: () => WorkspaceSnapshot): WorkspaceWatcher => ({ current: get, refresh: async () => null, close: async () => undefined });
const PR = JSON.stringify({ number: 7, url: 'https://github.com/o/r/pull/7', state: 'OPEN', isDraft: false, statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }] });

function execWith(handlers: { remote?: ExecResult; auth?: ExecResult; view?: (branch: string) => ExecResult }): ReturnType<typeof vi.fn> & Exec {
  return vi.fn(async (file: string, args: string[]) => {
    if (file === 'git') return handlers.remote ?? res(0, 'https://github.com/o/r.git\n');
    if (args[0] === 'auth') return handlers.auth ?? res(0);
    return handlers.view ? handlers.view(args[2]!) : res(0, PR);
  }) as never;
}

describe('reduceChecks', () => {
  it('reduces the rollup', () => {
    expect(reduceChecks([])).toBe('none');
    expect(reduceChecks(undefined)).toBe('none');
    expect(reduceChecks([{ status: 'COMPLETED', conclusion: 'SUCCESS' }, { status: 'COMPLETED', conclusion: 'SKIPPED' }, { status: 'COMPLETED', conclusion: 'NEUTRAL' }])).toBe('success');
    expect(reduceChecks([{ status: 'COMPLETED', conclusion: 'SUCCESS' }, { status: 'IN_PROGRESS', conclusion: '' }])).toBe('pending');
    expect(reduceChecks([{ status: 'IN_PROGRESS' }, { status: 'COMPLETED', conclusion: 'TIMED_OUT' }])).toBe('failure');
    for (const conclusion of ['FAILURE', 'ERROR', 'CANCELLED']) expect(reduceChecks([{ status: 'COMPLETED', conclusion }])).toBe('failure');
    expect(reduceChecks([{ state: 'SUCCESS' }])).toBe('success');
    expect(reduceChecks([{ state: 'PENDING' }])).toBe('pending');
  });

  it('parses gh pr view output defensively', () => {
    expect(parsePrView(PR)).toEqual({ pr: { number: 7, url: 'https://github.com/o/r/pull/7', state: 'OPEN', isDraft: false }, checks: 'success' });
    expect(parsePrView('not json')).toEqual({ pr: null, checks: 'none' });
    expect(parsePrView('{"number":1}')).toEqual({ pr: null, checks: 'none' });
  });
});

describe('github feed', () => {
  const make = (exec: Exec, cycles: () => CycleSummary[], broadcast = vi.fn(), loadLib: () => Promise<GithubKitLib | null> = async () => lib) =>
    ({ broadcast, feed: createGithubFeed({ watcher: watcherOf(() => snap(cycles())), root: '/r', broadcastChanged: broadcast, exec, loadLib }) });

  it('builds PR and checks for every in-progress cycle', async () => {
    const { feed, broadcast } = make(execWith({}), () => [cycle('spec-x-001-a', 'cycle-01'), cycle('spec-x-002-b', 'cycle-02', 'completed')]);
    await feed.refresh();
    expect(feed.watcher.current().github).toEqual({
      remote: { url: 'https://github.com/o/r.git', owner: 'o', name: 'r' },
      cycles: [{ specId: 'spec-x-001-a', cycle: 'cycle-01', branch: 'feat/a-cycle-01', pr: { number: 7, url: 'https://github.com/o/r/pull/7', state: 'OPEN', isDraft: false }, checks: 'success' }],
    });
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(broadcast.mock.calls[0]![0]).toEqual([]);
    feed.close();
  });

  it('has no feed without a remote, a non-GitHub remote or a missing kit lib', async () => {
    for (const [exec, loadLib] of [
      [execWith({ remote: res(2) }), async () => lib],
      [execWith({ remote: res(0, 'https://gitlab.com/o/r.git') }), async () => lib],
      [execWith({}), async () => null],
    ] as const) {
      const { feed, broadcast } = make(exec, () => [cycle('spec-x-001-a', 'cycle-01')], vi.fn(), loadLib);
      await feed.refresh();
      expect(feed.watcher.current().github).toBeUndefined();
      expect(broadcast).not.toHaveBeenCalled();
      feed.close();
    }
  });

  it('degrades to pr null when gh fails or is not authenticated', async () => {
    const failing = make(execWith({ view: () => res(1) }), () => [cycle('spec-x-001-a', 'cycle-01')]);
    await failing.feed.refresh();
    expect(failing.feed.watcher.current().github?.cycles[0]).toMatchObject({ pr: null, checks: 'none' });
    failing.feed.close();

    const exec = execWith({ auth: res(1) });
    const anon = make(exec, () => [cycle('spec-x-001-a', 'cycle-01')]);
    await anon.feed.refresh();
    expect(anon.feed.watcher.current().github?.cycles[0]).toMatchObject({ branch: 'feat/a-cycle-01', pr: null, checks: 'none' });
    expect(exec.mock.calls.some((c) => c[1][0] === 'pr')).toBe(false);
    anon.feed.close();
  });

  it('broadcasts only when the value changes', async () => {
    let view = res(0, PR);
    const { feed, broadcast } = make(execWith({ view: () => view }), () => [cycle('spec-x-001-a', 'cycle-01')]);
    await feed.refresh();
    await feed.refresh();
    expect(broadcast).toHaveBeenCalledTimes(1);
    view = res(0, JSON.stringify({ number: 7, url: 'https://github.com/o/r/pull/7', state: 'MERGED', isDraft: false, statusCheckRollup: [] }));
    await feed.refresh();
    expect(broadcast).toHaveBeenCalledTimes(2);
    expect(broadcast.mock.calls[1]![1].github.cycles[0].pr.state).toBe('MERGED');
    feed.close();
  });

  it('refreshes on the interval and when the in-progress cycles change', async () => {
    vi.useFakeTimers();
    try {
      let cycles = [cycle('spec-x-001-a', 'cycle-01')];
      const exec = execWith({});
      const feed = createGithubFeed({ watcher: watcherOf(() => snap(cycles)), root: '/r', broadcastChanged: vi.fn(), exec, loadLib: async () => lib, intervalMs: 60_000 });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(feed.watcher.current().github?.cycles).toHaveLength(1);
      cycles = [...cycles, cycle('spec-x-003-c', 'cycle-01')];
      feed.notifyWorkspaceChanged();
      await vi.advanceTimersByTimeAsync(1);
      expect(feed.watcher.current().github?.cycles).toHaveLength(2);
      feed.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it('withGithub leaves the snapshot alone without data', () => {
    const base = snap([]);
    expect(withGithub(base, null)).toBe(base);
  });
});
