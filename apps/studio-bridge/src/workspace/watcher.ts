import path from 'node:path';
import chokidar from 'chokidar';
import type { Area, BotEvent, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { diffSnapshots } from './diff';
import { changedAreas, loadWorkspaceSnapshot, mergeSnapshot } from './snapshot';

export interface WorkspaceUpdate {
  snapshot: WorkspaceSnapshot;
  areas: Area[];
  events: BotEvent[];
}

export interface WorkspaceWatcher {
  current(): WorkspaceSnapshot;
  refresh(): Promise<WorkspaceUpdate | null>;
  close(): Promise<void>;
}

const IGNORED_DIRS = ['docs', 'node_modules', 'documentation'];

export async function startWorkspaceWatcher(opts: {
  root: string;
  debounceMs?: number;
  onUpdate: (update: WorkspaceUpdate) => void;
  onError?: (error: unknown) => void;
}): Promise<WorkspaceWatcher> {
  let current = mergeSnapshot(null, await loadWorkspaceSnapshot(opts.root));
  let timer: NodeJS.Timeout | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let closed = false;

  const doRefresh = async (): Promise<WorkspaceUpdate | null> => {
    if (closed) return null;
    const next = mergeSnapshot(current, await loadWorkspaceSnapshot(opts.root));
    const areas = changedAreas(current, next);
    if (areas.length === 0 || closed) return null;
    const update = { snapshot: next, areas, events: diffSnapshots(current, next) };
    current = next;
    opts.onUpdate(update);
    return update;
  };

  // Every refresh (debounced or public) goes through one chain: never concurrent, always diffed against the latest state.
  const enqueue = (): Promise<WorkspaceUpdate | null> => {
    const result = queue.then(doRefresh);
    queue = result.catch(() => null);
    return result;
  };

  const schedule = (): void => {
    if (closed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      enqueue().catch((error) => opts.onError?.(error));
    }, opts.debounceMs ?? 200);
  };

  const sddDir = path.join(opts.root, 'sdd');
  const ignoredRoots = IGNORED_DIRS.map((d) => path.join(sddDir, d));
  const isIgnored = (p: string): boolean =>
    ignoredRoots.some((r) => p === r || p.startsWith(r + path.sep));

  const watcher = chokidar.watch(sddDir, { ignoreInitial: true, ignored: isIgnored });
  watcher.on('all', schedule);
  await new Promise<void>((resolve, reject) => {
    watcher.once('ready', () => resolve());
    watcher.once('error', (error) => reject(error));
  }).catch(async (error) => {
    closed = true;
    await watcher.close();
    throw error;
  });
  watcher.on('error', (error) => opts.onError?.(error));

  return {
    current: () => current,
    refresh: () => enqueue(),
    close: async () => {
      closed = true;
      if (timer) clearTimeout(timer);
      await watcher.close();
      await queue;
    },
  };
}
