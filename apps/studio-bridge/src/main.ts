import { existsSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { WS_CLOSE_WORKSPACE_SWITCHED, type AuthMode, type ServerMessage } from '@sdd-studio/protocol';
import { AuthState, CLIENT_APP } from './auth-mode';
import { ClaudeLogin } from './auth/claude-login';
import { openProjectRuntime, type ProjectRuntime } from './project/runtime';
import { createHostHandlers, type HostCommand } from './server/router';
import { createToken } from './server/security';
import { startBridgeServer, type BridgeServer } from './server/ws-server';
import { BRIDGE_VERSION } from './version';

export class BridgeStartError extends Error {}

export const DEFAULT_WEB_URL = 'https://studio.sdd.estebanburgos.com.ar';
export const DEFAULT_ORIGINS = [DEFAULT_WEB_URL, 'http://localhost:*', 'http://127.0.0.1:*'];

export class BridgeHost {
  readonly auth: AuthState;
  readonly login: ClaudeLogin;
  runtime: ProjectRuntime | null = null;
  server: BridgeServer | null = null;
  private closing: Promise<void> | null = null;

  constructor(
    private readonly engine: 'claude' | 'fake',
    readonly allowTargets: string[],
  ) {
    this.auth = new AuthState(process.env, CLIENT_APP(BRIDGE_VERSION));
    this.login = new ClaudeLogin(() => this.auth.cliEnv());
  }

  broadcast = (message: ServerMessage): void => this.server?.broadcast(message);

  async openProject(root: string): Promise<ProjectRuntime> {
    const previous = this.runtime;
    this.runtime = null;
    await previous?.close();
    const runtime = await openProjectRuntime(root, {
      engine: this.engine,
      auth: this.auth,
      login: this.login,
      bridgeVersion: BRIDGE_VERSION,
      broadcast: this.broadcast,
    });
    this.runtime = runtime;
    return runtime;
  }

  announceSwitched(): void {
    const runtime = this.runtime;
    if (!runtime) return;
    this.broadcast({ kind: 'workspace.switched', root: runtime.root, project: runtime.project });
    setImmediate(() => this.server?.closeAll(WS_CLOSE_WORKSPACE_SWITCHED));
  }

  close(): Promise<void> {
    this.closing ??= (async () => {
      const runtime = this.runtime;
      this.runtime = null;
      const results = await Promise.allSettled([this.server?.close() ?? Promise.resolve(), runtime?.close() ?? Promise.resolve()]);
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed.length === 1) throw failed[0]!.reason;
      if (failed.length > 1) throw new AggregateError(failed.map((f) => f.reason), 'Bridge shutdown failed');
    })();
    return this.closing;
  }
}

export async function startBridge(o: {
  root: string;
  port: number;
  strictPort: boolean;
  engine: 'claude' | 'fake';
  allowedOrigins: string[];
  webUrl: string;
  token?: string;
  localUiDir?: string;
  allowTargets?: string[];
  hostCommands?: (host: BridgeHost) => (command: HostCommand) => Promise<unknown>;
}): Promise<{
  url: string;
  port: number;
  token: string;
  authMode: AuthMode;
  project: string | null;
  launcher: boolean;
  host: BridgeHost;
  close(): Promise<void>;
}> {
  if (o.localUiDir && !existsSync(path.join(o.localUiDir, 'w', 'index.html'))) {
    throw new BridgeStartError(
      `This bridge build does not include the local web UI (missing ${path.join(o.localUiDir, 'w', 'index.html')}).`,
    );
  }
  const resolved = path.resolve(o.root);
  const host = new BridgeHost(o.engine, o.allowTargets ?? []);
  const token = o.token ?? createToken();
  try {
    if (existsSync(path.join(resolved, 'sdd'))) {
      // Physical path: the SPEC GATE compares paths and a symlink at the root must not bypass it.
      await host.openProject(await realpath(resolved));
    }
    host.server = await startBridgeServer({
      port: o.port,
      strictPort: o.strictPort,
      token,
      allowedOrigins: o.allowedOrigins,
      localUiDir: o.localUiDir,
      handlers: createHostHandlers({
        bridgeVersion: BRIDGE_VERSION,
        auth: host.auth,
        login: host.login,
        runtime: () => host.runtime,
        hostCommands: o.hostCommands?.(host),
      }),
    });
  } catch (error) {
    await host.close().catch(() => undefined);
    throw error;
  }
  const port = host.server.port;
  const url = o.localUiDir
    ? `http://127.0.0.1:${port}/w/#bridge=${port}&token=${token}`
    : `${o.webUrl.replace(/\/+$/, '')}/w#bridge=${port}&token=${token}`;
  return {
    url,
    port,
    token,
    authMode: host.auth.mode(),
    project: host.runtime?.project ?? null,
    launcher: host.runtime === null,
    host,
    close: () => host.close(),
  };
}
