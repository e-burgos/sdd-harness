import { existsSync } from 'node:fs';
import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
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
const CLAUDE_CATALOG_DIRS = new Set(['agents', 'skills']);
const CLAUDE_WATCH_DEPTH = 3;

export function isClaudeCatalogPath(claudeDir: string, candidate: string): boolean {
  if (candidate === claudeDir) return true;
  const relative = path.relative(claudeDir, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
  return CLAUDE_CATALOG_DIRS.has(relative.split(path.sep)[0] ?? '');
}

const untilReady = (watcher: FSWatcher): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    watcher.once('ready', () => resolve());
    watcher.once('error', (error) => reject(error));
  });

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

  const claudeDir = path.join(opts.root, '.claude');
  const watchers: FSWatcher[] = [chokidar.watch(sddDir, { ignoreInitial: true, ignored: isIgnored })];
  if (existsSync(claudeDir)) {
    watchers.push(
      chokidar.watch(claudeDir, {
        ignoreInitial: true,
        depth: CLAUDE_WATCH_DEPTH,
        ignored: (candidate) => !isClaudeCatalogPath(claudeDir, candidate),
      }),
    );
  }
  for (const watcher of watchers) watcher.on('all', schedule);
  const closeAll = () => Promise.all(watchers.map((watcher) => watcher.close()));
  await Promise.all(watchers.map(untilReady)).catch(async (error) => {
    closed = true;
    await closeAll();
    throw error;
  });
  for (const watcher of watchers) watcher.on('error', (error) => opts.onError?.(error));

  return {
    current: () => current,
    refresh: () => enqueue(),
    close: async () => {
      closed = true;
      if (timer) clearTimeout(timer);
      await closeAll();
      await queue;
    },
  };
}
