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

const IGNORED = /[\\/]sdd[\\/](docs|node_modules)([\\/]|$)/;

export async function startWorkspaceWatcher(opts: {
  root: string;
  debounceMs?: number;
  onUpdate: (update: WorkspaceUpdate) => void;
  onError?: (error: unknown) => void;
}): Promise<WorkspaceWatcher> {
  let current = mergeSnapshot(null, await loadWorkspaceSnapshot(opts.root));
  let timer: NodeJS.Timeout | null = null;
  let running: Promise<WorkspaceUpdate | null> | null = null;
  let dirty = false;
  let closed = false;

  const refresh = async (): Promise<WorkspaceUpdate | null> => {
    const next = mergeSnapshot(current, await loadWorkspaceSnapshot(opts.root));
    const areas = changedAreas(current, next);
    if (areas.length === 0 || closed) return null;
    const update = { snapshot: next, areas, events: diffSnapshots(current, next) };
    current = next;
    opts.onUpdate(update);
    return update;
  };

  const run = async (): Promise<void> => {
    timer = null;
    if (running) {
      dirty = true;
      return;
    }
    running = refresh().catch((error) => {
      opts.onError?.(error);
      return null;
    });
    await running;
    running = null;
    if (dirty && !closed) {
      dirty = false;
      schedule();
    }
  };

  const schedule = (): void => {
    if (closed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void run(), opts.debounceMs ?? 200);
  };

  const watcher = chokidar.watch(path.join(opts.root, 'sdd'), {
    ignoreInitial: true,
    ignored: (p: string) => IGNORED.test(p),
  });
  watcher.on('all', schedule);
  watcher.on('error', (error) => opts.onError?.(error));
  await new Promise<void>((resolve) => watcher.once('ready', () => resolve()));

  return {
    current: () => current,
    refresh: async () => {
      if (running) await running;
      return refresh();
    },
    close: async () => {
      closed = true;
      if (timer) clearTimeout(timer);
      await watcher.close();
    },
  };
}
