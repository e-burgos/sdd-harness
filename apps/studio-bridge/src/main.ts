import { existsSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import type { AuthMode, ServerMessage } from '@sdd-studio/protocol';
import { AuthState, CLIENT_APP } from './auth-mode';
import { CommandRunner } from './commands/runner';
import { ClaudeAgentSdkEngine } from './engine/claude-sdk-engine';
import { FakeEngine } from './engine/fake-engine';
import { createHandlers } from './server/router';
import { createToken } from './server/security';
import { startBridgeServer, type BridgeServer } from './server/ws-server';
import { createAttachmentStore } from './sessions/attachment-store';
import { SessionManager } from './sessions/session-manager';
import { ThreadStore } from './sessions/store';
import { BRIDGE_VERSION } from './version';
import { startWorkspaceWatcher } from './workspace/watcher';

export class BridgeStartError extends Error {}

export const DEFAULT_WEB_URL = 'https://studio.sdd.estebanburgos.com.ar';
export const DEFAULT_ORIGINS = [DEFAULT_WEB_URL, 'http://localhost:*', 'http://127.0.0.1:*'];

export async function startBridge(o: {
  root: string;
  port: number;
  strictPort: boolean;
  engine: 'claude' | 'fake';
  allowedOrigins: string[];
  webUrl: string;
  token?: string;
  localUiDir?: string;
}): Promise<{ url: string; port: number; token: string; authMode: AuthMode; project: string; close(): Promise<void> }> {
  if (o.localUiDir && !existsSync(path.join(o.localUiDir, 'w', 'index.html'))) {
    throw new BridgeStartError(
      `This bridge build does not include the local web UI (missing ${path.join(o.localUiDir, 'w', 'index.html')}).`,
    );
  }
  const resolved = path.resolve(o.root);
  if (!existsSync(path.join(resolved, 'sdd'))) {
    throw new BridgeStartError(
      `No sdd/ folder found in ${resolved}. Run sdd-studio at the root of a repo with the SDD kit (install it with \`npx @e-burgos/sdd-harness configure sdd\`).`,
    );
  }
  // Physical path: the SPEC GATE compares paths and a symlink at the root must not bypass it.
  const root = await realpath(resolved);
  const store = new ThreadStore(root);
  await store.init();
  const attachments = createAttachmentStore(root);
  await attachments.init();
  let server: BridgeServer | null = null;
  const broadcast = (message: ServerMessage) => server?.broadcast(message);

  const watcher = await startWorkspaceWatcher({
    root,
    onError: (error) => console.error('[sdd-studio] watcher:', error),
    onUpdate: (update) => {
      broadcast({ kind: 'workspace.changed', areas: update.areas, snapshot: update.snapshot });
      for (const event of update.events) {
        store.appendBot(event);
        broadcast({ kind: 'bot.event', ...event });
      }
    },
  });
  const token = o.token ?? createToken();
  const auth = new AuthState(process.env, CLIENT_APP(BRIDGE_VERSION));
  let started: BridgeServer;
  try {
    const engine = o.engine === 'fake' ? new FakeEngine() : new ClaudeAgentSdkEngine(undefined, () => auth.env());
    const sessions = new SessionManager({
      root,
      attachments,
      engine,
      store,
      snapshot: () => watcher.current(),
      broadcast,
      refreshSnapshot: () => watcher.refresh().then(() => undefined),
    });
    await sessions.recover();
    const runner = new CommandRunner(root, broadcast);

    started = await startBridgeServer({
      port: o.port,
      strictPort: o.strictPort,
      token,
      allowedOrigins: o.allowedOrigins,
      localUiDir: o.localUiDir,
      handlers: createHandlers({ root, auth, bridgeVersion: BRIDGE_VERSION, sessions, watcher, runner, store, attachments }),
    });
    server = started;
  } catch (error) {
    // Partial startup (e.g. listen rejected): do not leave the watcher running.
    await watcher.close().catch(() => undefined);
    throw error;
  }
  const url = o.localUiDir
    ? `http://127.0.0.1:${started.port}/w/#bridge=${started.port}&token=${token}`
    : `${o.webUrl.replace(/\/+$/, '')}/w#bridge=${started.port}&token=${token}`;
  return {
    url,
    port: started.port,
    token,
    authMode: auth.mode(),
    project: watcher.current().project,
    close: async () => {
      const results = await Promise.allSettled([
        server?.close() ?? Promise.resolve(),
        watcher.close(),
        store.flush(),
      ]);
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed.length === 1) throw failed[0]!.reason;
      if (failed.length > 1) throw new AggregateError(failed.map((f) => f.reason), 'Bridge shutdown failed');
    },
  };
}
