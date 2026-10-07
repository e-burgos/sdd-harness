import { existsSync } from 'node:fs';
import path from 'node:path';
import type { AuthMode, ServerMessage } from '@sdd-studio/protocol';
import { detectAuthMode } from './auth-mode';
import { CommandRunner } from './commands/runner';
import { ClaudeAgentSdkEngine } from './engine/claude-sdk-engine';
import { FakeEngine } from './engine/fake-engine';
import { createHandlers } from './server/router';
import { createToken } from './server/security';
import { startBridgeServer, type BridgeServer } from './server/ws-server';
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
}): Promise<{ url: string; port: number; token: string; authMode: AuthMode; project: string; close(): Promise<void> }> {
  const root = path.resolve(o.root);
  if (!existsSync(path.join(root, 'sdd'))) {
    throw new BridgeStartError(
      `No encontré sdd/ en ${root}. Corré sdd-studio en la raíz de un repo con el kit (instalalo con \`harness init\`).`,
    );
  }
  const store = new ThreadStore(root);
  await store.init();
  let server: BridgeServer | null = null;
  const broadcast = (message: ServerMessage) => server?.broadcast(message);

  const watcher = await startWorkspaceWatcher({
    root,
    onUpdate: (update) => {
      broadcast({ kind: 'workspace.changed', areas: update.areas, snapshot: update.snapshot });
      for (const event of update.events) {
        store.appendBot(event);
        broadcast({ kind: 'bot.event', ...event });
      }
    },
  });
  const token = o.token ?? createToken();
  const authMode = detectAuthMode();
  let started: BridgeServer;
  try {
    const engine = o.engine === 'fake' ? new FakeEngine() : new ClaudeAgentSdkEngine();
    const sessions = new SessionManager({ root, engine, store, snapshot: () => watcher.current(), broadcast });
    const runner = new CommandRunner(root, broadcast);

    started = await startBridgeServer({
      port: o.port,
      strictPort: o.strictPort,
      token,
      allowedOrigins: o.allowedOrigins,
      handlers: createHandlers({ root, authMode, bridgeVersion: BRIDGE_VERSION, sessions, watcher, runner, store }),
    });
    server = started;
  } catch (error) {
    // Arranque parcial (p. ej. listen rechazó): no dejar el watcher vivo.
    await watcher.close().catch(() => undefined);
    throw error;
  }
  const url = `${o.webUrl.replace(/\/+$/, '')}/w#bridge=${started.port}&token=${token}`;
  return {
    url,
    port: started.port,
    token,
    authMode,
    project: watcher.current().project,
    close: async () => {
      const results = await Promise.allSettled([
        server?.close() ?? Promise.resolve(),
        watcher.close(),
        store.flush(),
      ]);
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed.length === 1) throw failed[0]!.reason;
      if (failed.length > 1) throw new AggregateError(failed.map((f) => f.reason), 'Falló el cierre del puente');
    },
  };
}
