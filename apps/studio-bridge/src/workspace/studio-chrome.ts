import { spawn } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import http from 'node:http';
import { homedir } from 'node:os';
import path from 'node:path';

export const STUDIO_CHROME_PORT = 9333;
export const STUDIO_CHROME_URL = `http://127.0.0.1:${STUDIO_CHROME_PORT}`;
export const PROBE_TIMEOUT_MS = 1500;
export const LAUNCH_WAIT_MS = 10_000;
const POLL_INTERVAL_MS = 250;

export class StudioChromeError extends Error {
  constructor(readonly code: 'no-binary' | 'launch-failed' | 'timeout', message: string) {
    super(message);
  }
}

export const studioChromeProfile = (env: NodeJS.ProcessEnv = process.env, home: () => string = homedir): string =>
  path.join(env.SDD_STUDIO_HOME || home(), '.sdd-studio', 'chrome-profile');

export const chromeLaunchArgs = (profile: string): string[] => [
  `--remote-debugging-port=${STUDIO_CHROME_PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
];

export const probeUrl = (baseUrl: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> =>
  new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    try {
      const request = http.get(new URL('/json/version', baseUrl), { timeout: timeoutMs }, (response) => {
        response.resume();
        done((response.statusCode ?? 500) < 400);
      });
      request.on('timeout', () => {
        request.destroy();
        done(false);
      });
      request.on('error', () => done(false));
    } catch {
      done(false);
    }
  });

export interface BinaryDeps {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  home: () => string;
  exists: (file: string) => Promise<boolean>;
  which: (name: string) => Promise<string | null>;
}

export const fileExists = (file: string): Promise<boolean> => access(file).then(() => true, () => false);

export const whichInPath = async (name: string, env: NodeJS.ProcessEnv = process.env): Promise<string | null> => {
  for (const dir of (env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(dir, name);
    if (await fileExists(candidate)) return candidate;
  }
  return null;
};

export async function resolveChromeBinary(deps: BinaryDeps): Promise<string | null> {
  if (deps.platform === 'darwin') {
    const suffix = path.join('Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome');
    for (const candidate of [path.join('/', suffix), path.join(deps.home(), suffix)]) {
      if (await deps.exists(candidate)) return candidate;
    }
    return null;
  }
  if (deps.platform === 'win32') {
    const tail = path.win32.join('Google', 'Chrome', 'Application', 'chrome.exe');
    const roots = [deps.env.PROGRAMFILES, deps.env['PROGRAMFILES(X86)'], deps.env.LOCALAPPDATA].filter((root): root is string => Boolean(root));
    for (const root of roots) {
      const candidate = path.win32.join(root, tail);
      if (await deps.exists(candidate)) return candidate;
    }
    return null;
  }
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const found = await deps.which(name);
    if (found) return found;
  }
  return null;
}

export interface StudioChromeDeps {
  probe: () => Promise<boolean>;
  resolveBinary: () => Promise<string | null>;
  launch: (binary: string, args: string[]) => void;
  mkdir: (dir: string) => Promise<void>;
  profile: () => string;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  waitMs?: number;
}

export interface StudioChromeService {
  probe(): Promise<boolean>;
  ensure(): Promise<{ launched: boolean }>;
}

export const defaultStudioChromeDeps = (): StudioChromeDeps => ({
  probe: () => probeUrl(STUDIO_CHROME_URL),
  resolveBinary: () =>
    resolveChromeBinary({ platform: process.platform, env: process.env, home: homedir, exists: fileExists, which: (name) => whichInPath(name) }),
  launch: (binary, args) => {
    const child = spawn(binary, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => undefined);
    child.unref();
  },
  mkdir: async (dir) => {
    await mkdir(dir, { recursive: true });
  },
  profile: () => studioChromeProfile(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
});

export function createStudioChrome(deps: StudioChromeDeps = defaultStudioChromeDeps()): StudioChromeService {
  let inflight: Promise<{ launched: boolean }> | null = null;

  const run = async (): Promise<{ launched: boolean }> => {
    if (await deps.probe()) return { launched: false };
    const binary = await deps.resolveBinary();
    if (!binary) throw new StudioChromeError('no-binary', 'Google Chrome was not found');
    const profile = deps.profile();
    await deps.mkdir(profile);
    try {
      deps.launch(binary, chromeLaunchArgs(profile));
    } catch (error) {
      throw new StudioChromeError('launch-failed', error instanceof Error ? error.message.slice(0, 200) : 'Chrome could not be launched');
    }
    const deadline = deps.now() + (deps.waitMs ?? LAUNCH_WAIT_MS);
    while (deps.now() < deadline) {
      await deps.sleep(POLL_INTERVAL_MS);
      if (await deps.probe()) return { launched: true };
    }
    throw new StudioChromeError('timeout', 'Chrome did not open its debugging port in time');
  };

  return {
    probe: () => deps.probe(),
    ensure: () => {
      inflight ??= run().finally(() => {
        inflight = null;
      });
      return inflight;
    },
  };
}

export const studioChrome: StudioChromeService = createStudioChrome();

export const openNewTab = (baseUrl: string = STUDIO_CHROME_URL, timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> =>
  new Promise((resolve) => {
    try {
      const request = http.request(new URL('/json/new?about:blank', baseUrl), { method: 'PUT', timeout: timeoutMs }, (response) => {
        response.resume();
        resolve((response.statusCode ?? 500) < 400);
      });
      request.on('timeout', () => {
        request.destroy();
        resolve(false);
      });
      request.on('error', () => resolve(false));
      request.end();
    } catch {
      resolve(false);
    }
  });
