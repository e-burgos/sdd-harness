import type { Area, FileLeaseSummary, SessionBinding, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { MAX_FILE_LEASES, MAX_SESSION_BINDINGS } from '@sdd-studio/protocol';
import type { WorkspaceWatcher } from './watcher';

export const SESSIONS_REFRESH_MS = 30_000;

export interface SessionsSource {
  listLive(): Promise<SessionBinding[]>;
  listLeases?(): Promise<FileLeaseSummary[]>;
}

type Registry = { sessions: SessionBinding[]; leases?: FileLeaseSummary[] };

export interface SessionsFeed {
  readonly watcher: WorkspaceWatcher;
  refresh(): Promise<void>;
  close(): void;
}

export function withSessions(snapshot: WorkspaceSnapshot, registry: Registry | null): WorkspaceSnapshot {
  if (registry === null) return snapshot;
  return registry.leases === undefined
    ? { ...snapshot, sessions: registry.sessions }
    : { ...snapshot, sessions: registry.sessions, leases: registry.leases };
}

export function createSessionsFeed(opts: {
  watcher: WorkspaceWatcher;
  source: SessionsSource | null;
  broadcastChanged: (areas: Area[], snapshot: WorkspaceSnapshot) => void;
  intervalMs?: number;
}): SessionsFeed {
  const { watcher, source } = opts;
  let sessions: Registry | null = source ? { sessions: [], ...(source.listLeases ? { leases: [] } : {}) } : null;
  let key = JSON.stringify(sessions);
  let closed = false;

  const refresh = async (): Promise<void> => {
    if (!source || closed) return;
    const live = (await source.listLive()).slice(0, MAX_SESSION_BINDINGS);
    const leases = source.listLeases ? (await source.listLeases()).slice(0, MAX_FILE_LEASES) : undefined;
    const next: Registry = leases === undefined ? { sessions: live } : { sessions: live, leases };
    const nextKey = JSON.stringify(next);
    if (nextKey === key) return;
    sessions = next;
    key = nextKey;
    opts.broadcastChanged([], withSessions(watcher.current(), sessions));
  };

  const timer = source ? setInterval(() => void refresh().catch(() => undefined), opts.intervalMs ?? SESSIONS_REFRESH_MS) : null;
  timer?.unref();

  return {
    watcher: {
      current: () => withSessions(watcher.current(), sessions),
      refresh: async () => {
        const update = await watcher.refresh();
        await refresh().catch(() => undefined);
        return update ? { ...update, snapshot: withSessions(update.snapshot, sessions) } : null;
      },
      close: () => watcher.close(),
    },
    refresh,
    close: () => {
      closed = true;
      if (timer) clearInterval(timer);
    },
  };
}
