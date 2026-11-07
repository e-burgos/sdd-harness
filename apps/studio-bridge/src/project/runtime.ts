import type { Presence, ServerMessage } from '@sdd-studio/protocol';
import type { AuthState } from '../auth-mode';
import type { ClaudeLogin } from '../auth/claude-login';
import { CommandRunner } from '../commands/runner';
import { ClaudeAgentSdkEngine } from '../engine/claude-sdk-engine';
import { FakeEngine } from '../engine/fake-engine';
import { createHandlers } from '../server/router';
import type { BridgeHandlers } from '../server/ws-server';
import { createAttachmentStore } from '../sessions/attachment-store';
import { SessionManager } from '../sessions/session-manager';
import { SessionBindings } from '../sessions/session-bindings';
import { ThreadStore } from '../sessions/store';
import { createGithubFeed, type GithubFeed } from '../github/pr-feed';
import { createFileIndex } from '../workspace/file-index';
import { KitIndexer } from '../workspace/kit-index';
import { createSessionsFeed, type SessionsFeed } from '../workspace/sessions-feed';
import { startWorkspaceWatcher } from '../workspace/watcher';

export interface ProjectRuntime {
  readonly root: string;
  readonly project: string;
  handle: BridgeHandlers['handle'];
  welcomePart(): { workspace: { root: string; project: string }; kitVersion: string | null };
  presence(): Presence[];
  isBusy(): boolean;
  refreshGithub(): Promise<void>;
  close(): Promise<void>;
}

export interface ProjectRuntimeDeps {
  engine: 'claude' | 'fake';
  auth: AuthState;
  login: Pick<ClaudeLogin, 'status' | 'login' | 'logout'>;
  bridgeVersion: string;
  broadcast: (message: ServerMessage) => void;
}

export async function openProjectRuntime(root: string, deps: ProjectRuntimeDeps): Promise<ProjectRuntime> {
  const { broadcast, auth } = deps;
  const store = new ThreadStore(root);
  await store.init();
  const attachments = createAttachmentStore(root);
  await attachments.init();
  const fileIndex = createFileIndex(root);

  const kitIndexer = new KitIndexer({
    root,
    onChanged: ({ sections, revision }) => broadcast({ kind: 'kit.changed', sections, revision }),
  });

  let feed: SessionsFeed | null = null;
  let githubFeed: GithubFeed | null = null;
  const bindings = await SessionBindings.load(root, { onChange: () => void feed?.refresh().catch(() => undefined) });

  const rawWatcher = await startWorkspaceWatcher({
    root,
    onPath: (changedPath) => kitIndexer.notifyPath(changedPath),
    onError: (error) => console.error('[sdd-studio] watcher:', error),
    onUpdate: (update) => {
      broadcast({ kind: 'workspace.changed', areas: update.areas, snapshot: githubFeed?.watcher.current() ?? update.snapshot });
      githubFeed?.notifyWorkspaceChanged();
      const at = new Date().toISOString();
      for (const event of update.events) {
        const stamped = { ...event, at };
        store.appendBot(stamped);
        broadcast({ kind: 'bot.event', ...stamped });
      }
    },
  });

  feed = createSessionsFeed({
    watcher: rawWatcher,
    source: bindings,
    broadcastChanged: (areas) => broadcast({ kind: 'workspace.changed', areas, snapshot: (githubFeed ?? feed)?.watcher.current() ?? rawWatcher.current() }),
  });
  githubFeed = createGithubFeed({
    watcher: feed.watcher,
    root,
    broadcastChanged: (areas, snapshot) => broadcast({ kind: 'workspace.changed', areas, snapshot }),
  });
  const watcher = githubFeed.watcher;
  void feed.refresh().catch(() => undefined);
  void githubFeed.refresh().catch(() => undefined);

  const runner = new CommandRunner(root, broadcast);
  let sessions: SessionManager;
  let handlers: BridgeHandlers;
  try {
    const engine = deps.engine === 'fake' ? new FakeEngine() : new ClaudeAgentSdkEngine(undefined, () => auth.env());
    sessions = new SessionManager({
      root,
      attachments,
      engine,
      store,
      snapshot: () => watcher.current(),
      broadcast,
      refreshSnapshot: () => watcher.refresh().then(() => undefined),
      ...(bindings ? { bindings } : {}),
    });
    await sessions.recover();
    handlers = createHandlers({
      root,
      auth,
      login: deps.login,
      bridgeVersion: deps.bridgeVersion,
      sessions,
      watcher,
      runner,
      store,
      attachments,
      fileIndex,
      kitIndexer,
      broadcast,
    });
  } catch (error) {
    kitIndexer.close();
    feed.close();
    githubFeed.close();
    await watcher.close().catch(() => undefined);
    throw error;
  }

  let closing: Promise<void> | null = null;
  const close = (): Promise<void> => {
    closing ??= (async () => {
      kitIndexer.close();
      feed?.close();
      githubFeed?.close();
      runner.terminateAll();
      const results = await Promise.allSettled([sessions.shutdown(), watcher.close(), store.flush()]);
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed.length === 1) throw failed[0]!.reason;
      if (failed.length > 1) throw new AggregateError(failed.map((f) => f.reason), 'Project runtime shutdown failed');
    })();
    return closing;
  };

  return {
    root,
    project: watcher.current().project,
    handle: handlers.handle,
    welcomePart: () => ({ workspace: { root, project: watcher.current().project }, kitVersion: watcher.current().kitVersion }),
    presence: () => sessions.presence(),
    refreshGithub: () => githubFeed?.refresh() ?? Promise.resolve(),
    isBusy: () => sessions.isBusy() || runner.activeRuns() > 0,
    close,
  };
}
