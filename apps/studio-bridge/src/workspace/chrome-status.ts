import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import type { ClaudeBrowserState, ClaudeBrowserStatus } from '@sdd-studio/protocol';

export const CHROME_CONNECT_TIMEOUT_MS = 8000;
export const CHROME_SETTINGS_URL = 'chrome://inspect/#remote-debugging';

export type ChromePlatform = NodeJS.Platform;

export interface ChromeConnectResult {
  open: boolean;
  detail: string | null;
}

export interface ChromeCheckDeps {
  platform: ChromePlatform;
  homedir: () => string;
  env: NodeJS.ProcessEnv;
  readFile: (file: string) => Promise<string>;
  isChromeRunning: () => Promise<boolean | null>;
  connect: (url: string, timeoutMs: number) => Promise<ChromeConnectResult>;
  browserEnabled: () => boolean;
  now: () => Date;
}

export const devToolsActivePortFile = (platform: ChromePlatform, home: string, env: NodeJS.ProcessEnv): string => {
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'DevToolsActivePort');
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local');
    return path.win32.join(local, 'Google', 'Chrome', 'User Data', 'DevToolsActivePort');
  }
  return path.join(home, '.config', 'google-chrome', 'DevToolsActivePort');
};

const run = (file: string, args: string[]): Promise<{ ok: boolean; stdout: string }> =>
  new Promise((resolve) => {
    execFile(file, args, { timeout: 5000, windowsHide: true }, (error, stdout) => resolve({ ok: !error, stdout: String(stdout) }));
  });

export async function detectChromeRunning(platform: ChromePlatform): Promise<boolean | null> {
  try {
    if (platform === 'win32') {
      const result = await run('tasklist', ['/FI', 'IMAGENAME eq chrome.exe', '/NH']);
      return result.ok ? /chrome\.exe/i.test(result.stdout) : null;
    }
    if (platform === 'darwin') {
      const result = await run('pgrep', ['-x', 'Google Chrome']);
      return result.ok;
    }
    const result = await run('pgrep', ['-f', 'chrome']);
    return result.ok;
  } catch {
    return null;
  }
}

export const connectWebSocket = (url: string, timeoutMs: number): Promise<ChromeConnectResult> =>
  new Promise((resolve) => {
    let settled = false;
    const socket = new WebSocket(url, { handshakeTimeout: timeoutMs });
    const finish = (result: ChromeConnectResult) => {
      if (settled) return;
      settled = true;
      try {
        socket.terminate();
      } catch {
        // The socket is already gone.
      }
      resolve(result);
    };
    socket.once('open', () => finish({ open: true, detail: null }));
    socket.once('unexpected-response', (_req, res) => finish({ open: false, detail: `Chrome answered ${res.statusCode ?? 'with an error'}` }));
    socket.once('error', (error) => finish({ open: false, detail: error.message.slice(0, 200) }));
  });

export const defaultChromeCheckDeps = (browserEnabled: () => boolean): ChromeCheckDeps => ({
  platform: process.platform,
  homedir,
  env: process.env,
  readFile: (file) => readFile(file, 'utf8'),
  isChromeRunning: () => detectChromeRunning(process.platform),
  connect: connectWebSocket,
  browserEnabled,
  now: () => new Date(),
});

const status = (deps: ChromeCheckDeps, state: ClaudeBrowserState, detail: string | null): ClaudeBrowserStatus => ({
  state,
  checkedAt: deps.now().toISOString(),
  detail: detail === null ? null : detail.slice(0, 300),
});

export async function checkChrome(deps: ChromeCheckDeps): Promise<ClaudeBrowserStatus> {
  if (!deps.browserEnabled()) return status(deps, 'off', null);
  const running = await deps.isChromeRunning().catch(() => null);
  if (running === false) return status(deps, 'chrome-closed', null);
  const file = devToolsActivePortFile(deps.platform, deps.homedir(), deps.env);
  const raw = await deps.readFile(file).catch(() => null);
  if (raw === null) return status(deps, 'debugging-disabled', null);
  const [port, wsPath] = raw.split(/\r?\n/);
  if (!/^\d{1,5}$/.test(port ?? '') || !wsPath?.startsWith('/')) return status(deps, 'debugging-disabled', 'DevToolsActivePort is malformed');
  const result = await deps.connect(`ws://127.0.0.1:${port}${wsPath}`, CHROME_CONNECT_TIMEOUT_MS);
  return result.open ? status(deps, 'connected', null) : status(deps, 'permission-pending', result.detail);
}

export interface ChromeStatusService {
  current(): ClaudeBrowserStatus | null;
  check(): Promise<ClaudeBrowserStatus>;
  subscribe(listener: (status: ClaudeBrowserStatus) => void): () => void;
}

export function createChromeStatus(deps: ChromeCheckDeps): ChromeStatusService {
  let last: ClaudeBrowserStatus | null = null;
  let inflight: Promise<ClaudeBrowserStatus> | null = null;
  const listeners = new Set<(status: ClaudeBrowserStatus) => void>();

  const run = async (): Promise<ClaudeBrowserStatus> => {
    const next = await checkChrome(deps);
    const changed = last === null || last.state !== next.state;
    last = next;
    if (changed) for (const listener of listeners) listener(next);
    return next;
  };

  return {
    current: () => last,
    check: () => {
      inflight ??= run().finally(() => {
        inflight = null;
      });
      return inflight;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export interface OpenSettingsDeps {
  platform: ChromePlatform;
  exec: (file: string, args: string[]) => Promise<boolean>;
}

export const defaultOpenSettingsDeps = (): OpenSettingsDeps => ({
  platform: process.platform,
  exec: async (file, args) => (await run(file, args)).ok,
});

export async function openChromeSettings(deps: OpenSettingsDeps): Promise<{ opened: boolean }> {
  const url = CHROME_SETTINGS_URL;
  if (deps.platform === 'darwin') return { opened: await deps.exec('open', ['-a', 'Google Chrome', url]) };
  if (deps.platform === 'win32') return { opened: await deps.exec('cmd', ['/c', 'start', 'chrome', url]) };
  if (await deps.exec('google-chrome', [url])) return { opened: true };
  return { opened: await deps.exec('chromium', [url]) };
}
