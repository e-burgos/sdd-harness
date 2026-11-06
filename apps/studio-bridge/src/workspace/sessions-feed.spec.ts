import type { SessionBinding, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { describe, expect, it, vi } from 'vitest';
import { createSessionsFeed, withSessions } from './sessions-feed';
import type { WorkspaceWatcher } from './watcher';

const snapshot = {
  project: 'p', profile: 'team', kitVersion: null, specs: [], cycles: [], fixes: [], agents: [], skills: [], gateMode: 'block', pricing: null, stale: [],
} as WorkspaceSnapshot;

const binding = (sessionId: string): SessionBinding => ({
  sessionId, unit: { kind: 'fix', fixId: 'FIX-001' }, harness: 'claude-code', source: 'sdd-use', worktree: '/r',
  boundAt: '2026-11-06T10:00:00.000Z', updatedAt: '2026-11-06T10:00:00.000Z',
});

function fakeWatcher(): WorkspaceWatcher {
  return { current: () => snapshot, refresh: async () => null, close: async () => undefined };
}

describe('sessions feed', () => {
  it('leaves the snapshot untouched without a registry', async () => {
    const feed = createSessionsFeed({ watcher: fakeWatcher(), source: null, broadcastChanged: vi.fn() });
    expect(feed.watcher.current().sessions).toBeUndefined();
    await feed.refresh();
    expect(feed.watcher.current()).toBe(snapshot);
    feed.close();
  });

  it('merges live sessions into the snapshot and broadcasts only real changes', async () => {
    let live = [binding('a')];
    const broadcast = vi.fn();
    const feed = createSessionsFeed({ watcher: fakeWatcher(), source: { listLive: async () => live }, broadcastChanged: broadcast });
    await feed.refresh();
    expect(feed.watcher.current().sessions?.map((s) => s.sessionId)).toEqual(['a']);
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(broadcast.mock.calls[0]![0]).toEqual([]);
    await feed.refresh();
    expect(broadcast).toHaveBeenCalledTimes(1);
    live = [binding('a'), binding('b')];
    await feed.refresh();
    expect(broadcast).toHaveBeenCalledTimes(2);
    expect(broadcast.mock.calls[1]![1].sessions).toHaveLength(2);
    feed.close();
  });

  it('refreshes periodically because the registry lives outside the watched folder', async () => {
    vi.useFakeTimers();
    try {
      let live: SessionBinding[] = [];
      const broadcast = vi.fn();
      const feed = createSessionsFeed({ watcher: fakeWatcher(), source: { listLive: async () => live }, broadcastChanged: broadcast, intervalMs: 30_000 });
      live = [binding('a')];
      await vi.advanceTimersByTimeAsync(30_000);
      expect(broadcast).toHaveBeenCalledTimes(1);
      feed.close();
      live = [];
      await vi.advanceTimersByTimeAsync(60_000);
      expect(broadcast).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('withSessions keeps the snapshot when sessions are unavailable', () => {
    expect(withSessions(snapshot, null)).toBe(snapshot);
    expect(withSessions(snapshot, { sessions: [] }).sessions).toEqual([]);
    expect(withSessions(snapshot, { sessions: [], leases: [] }).leases).toEqual([]);
  });
});
