import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MAX_GITHUB_CYCLES, type Area, type CycleGithub, type GithubChecks, type GithubRemote, type SnapshotGithub, type WorkspaceSnapshot } from '@sdd-studio/protocol';
import type { WorkspaceWatcher } from '../workspace/watcher';
import { defaultExec, type Exec } from './exec';

export const GITHUB_REFRESH_MS = 60_000;
const COMMAND_TIMEOUT_MS = 15_000;
const KIT_LIB = ['sdd', 'scripts', 'lib', 'github.mjs'] as const;

export interface GithubKitLib {
  branchNameFor(specId: string, cycle: string): string;
  parseRemoteUrl(url: string): { owner: string; name: string } | null;
}

export type GithubLibLoader = (root: string) => Promise<GithubKitLib | null>;

const isKitLib = (value: unknown): value is GithubKitLib =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as GithubKitLib).branchNameFor === 'function' &&
  typeof (value as GithubKitLib).parseRemoteUrl === 'function';

export const loadGithubKitLib: GithubLibLoader = async (root) => {
  try {
    const module: unknown = await import(/* @vite-ignore */ pathToFileURL(path.join(root, ...KIT_LIB)).href);
    return isKitLib(module) ? module : null;
  } catch {
    return null;
  }
};

interface RollupEntry {
  conclusion?: string | null;
  status?: string | null;
  state?: string | null;
}

const FAILED = new Set(['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'STARTUP_FAILURE', 'ACTION_REQUIRED']);
const PASSED = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);

export function reduceChecks(rollup: unknown): GithubChecks {
  if (!Array.isArray(rollup) || rollup.length === 0) return 'none';
  let pending = false;
  for (const raw of rollup as RollupEntry[]) {
    const conclusion = (raw.conclusion ?? raw.state ?? '').toUpperCase();
    const status = (raw.status ?? 'COMPLETED').toUpperCase();
    if (FAILED.has(conclusion)) return 'failure';
    if (status !== 'COMPLETED' || !PASSED.has(conclusion)) pending = true;
  }
  return pending ? 'pending' : 'success';
}

const PR_STATES = new Set(['OPEN', 'CLOSED', 'MERGED']);

export function parsePrView(stdout: string): Pick<CycleGithub, 'pr' | 'checks'> {
  try {
    const body = JSON.parse(stdout) as { number?: unknown; url?: unknown; state?: unknown; isDraft?: unknown; statusCheckRollup?: unknown };
    if (typeof body.number !== 'number' || typeof body.url !== 'string' || typeof body.state !== 'string' || !PR_STATES.has(body.state)) {
      return { pr: null, checks: 'none' };
    }
    return {
      pr: { number: body.number, url: body.url.slice(0, 512), state: body.state as 'OPEN' | 'CLOSED' | 'MERGED', isDraft: body.isDraft === true },
      checks: reduceChecks(body.statusCheckRollup),
    };
  } catch {
    return { pr: null, checks: 'none' };
  }
}

export interface GithubFeed {
  readonly watcher: WorkspaceWatcher;
  refresh(): Promise<void>;
  notifyWorkspaceChanged(): void;
  close(): void;
}

export function withGithub(snapshot: WorkspaceSnapshot, github: SnapshotGithub | null): WorkspaceSnapshot {
  return github === null ? snapshot : { ...snapshot, github };
}

const inProgress = (snapshot: WorkspaceSnapshot) => snapshot.cycles.filter((c) => c.status === 'in-progress');
const cyclesKey = (snapshot: WorkspaceSnapshot): string => inProgress(snapshot).map((c) => `${c.specId}/${c.cycle}`).join('|');

export function createGithubFeed(opts: {
  watcher: WorkspaceWatcher;
  root: string;
  broadcastChanged: (areas: Area[], snapshot: WorkspaceSnapshot) => void;
  exec?: Exec;
  loadLib?: GithubLibLoader;
  intervalMs?: number;
}): GithubFeed {
  const { watcher, root } = opts;
  const exec = opts.exec ?? defaultExec;
  let github: SnapshotGithub | null = null;
  let key = JSON.stringify(github);
  let seenCycles = cyclesKey(watcher.current());
  let closed = false;
  let lib: Promise<GithubKitLib | null> | null = null;
  let running: Promise<void> | null = null;

  const git = (args: string[]) => exec('git', args, { cwd: root, timeoutMs: COMMAND_TIMEOUT_MS });
  const gh = (args: string[]) => exec('gh', args, { cwd: root, timeoutMs: COMMAND_TIMEOUT_MS });

  const readRemote = async (kit: GithubKitLib): Promise<GithubRemote | null> => {
    const result = await git(['remote', 'get-url', 'origin']);
    if (result.code !== 0) return null;
    const url = result.stdout.trim();
    const parsed = kit.parseRemoteUrl(url);
    return parsed ? { url: url.slice(0, 512), owner: parsed.owner, name: parsed.name } : null;
  };

  const readCycle = async (kit: GithubKitLib, ghReady: boolean, specId: string, cycle: string): Promise<CycleGithub> => {
    const branch = kit.branchNameFor(specId, cycle);
    if (!ghReady) return { specId, cycle, branch, pr: null, checks: 'none' };
    const view = await gh(['pr', 'view', branch, '--json', 'number,url,state,isDraft,statusCheckRollup']);
    return { specId, cycle, branch, ...(view.code === 0 ? parsePrView(view.stdout) : { pr: null, checks: 'none' as const }) };
  };

  const compute = async (): Promise<SnapshotGithub | null> => {
    lib ??= (opts.loadLib ?? loadGithubKitLib)(root);
    const kit = await lib;
    if (kit === null) return null;
    const remote = await readRemote(kit);
    if (remote === null) return null;
    const ghReady = (await gh(['auth', 'status'])).code === 0;
    const cycles: CycleGithub[] = [];
    for (const cycle of inProgress(watcher.current()).slice(0, MAX_GITHUB_CYCLES)) {
      cycles.push(await readCycle(kit, ghReady, cycle.specId, cycle.cycle));
    }
    return { remote, cycles };
  };

  const run = async (): Promise<void> => {
    if (closed) return;
    seenCycles = cyclesKey(watcher.current());
    const next = await compute();
    if (closed) return;
    const nextKey = JSON.stringify(next);
    if (nextKey === key) return;
    github = next;
    key = nextKey;
    opts.broadcastChanged([], withGithub(watcher.current(), github));
  };

  const refresh = (): Promise<void> => {
    running ??= run().finally(() => {
      running = null;
    });
    return running;
  };

  const notifyWorkspaceChanged = (): void => {
    if (cyclesKey(watcher.current()) !== seenCycles) void refresh().catch(() => undefined);
  };

  const timer = setInterval(() => void refresh().catch(() => undefined), opts.intervalMs ?? GITHUB_REFRESH_MS);
  timer.unref();

  return {
    watcher: {
      current: () => withGithub(watcher.current(), github),
      refresh: async () => {
        const update = await watcher.refresh();
        if (cyclesKey(watcher.current()) !== seenCycles) await refresh().catch(() => undefined);
        return update ? { ...update, snapshot: withGithub(update.snapshot, github) } : null;
      },
      close: () => watcher.close(),
    },
    refresh,
    notifyWorkspaceChanged,
    close: () => {
      closed = true;
      clearInterval(timer);
    },
  };
}
