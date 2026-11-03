import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { RtkGain } from '@sdd-studio/protocol';

export const RTK_CACHE_MS = 10_000;
export const RTK_GAIN_TIMEOUT_MS = 8_000;
const RTK_VERSION_TIMEOUT_MS = 5_000;
const RTK_MAX_BUFFER = 8 * 1024 * 1024;
const GAIN_ARGS = ['gain', '--project', '--all', '--format', 'json'];

export interface RtkOutput {
  stdout: string;
  stderr: string;
}

export type RunRtk = (binary: string, args: string[], cwd: string, timeoutMs: number) => Promise<RtkOutput>;

export interface RtkGainDeps {
  findBinary: () => string | null;
  run: RunRtk;
  now: () => number;
}

const isExecutableFile = (file: string): boolean => {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
};

export function rtkInstallDir(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): string {
  if (env.RTK_INSTALL_DIR) return path.resolve(env.RTK_INSTALL_DIR);
  if (platform === 'win32') {
    const base = env.LOCALAPPDATA ?? path.join(homedir(), 'AppData', 'Local');
    return path.join(base, 'rtk', 'bin');
  }
  return path.join(homedir(), '.local', 'bin');
}

export function findRtkBinary(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): string | null {
  if (env.RTK_BIN && isExecutableFile(env.RTK_BIN)) return env.RTK_BIN;
  const names = platform === 'win32' ? ['rtk.exe', 'rtk.cmd', 'rtk'] : ['rtk'];
  for (const dir of (env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (isExecutableFile(candidate)) return candidate;
    }
  }
  const local = path.join(rtkInstallDir(env, platform), platform === 'win32' ? 'rtk.exe' : 'rtk');
  return isExecutableFile(local) ? local : null;
}

const runRtk: RunRtk = (binary, args, cwd, timeoutMs) =>
  new Promise((resolve, reject) => {
    execFile(
      binary,
      args,
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: RTK_MAX_BUFFER,
        windowsHide: true,
        env: { ...process.env, RTK_TELEMETRY_DISABLED: '1' },
      },
      (error, stdout, stderr) => (error ? reject(error) : resolve({ stdout, stderr: stderr ?? '' })),
    );
  });

export function parseRtkVersion(output: string): string | null {
  if (!/\brtk\b/i.test(output)) return null;
  const match = output.match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
}

const defaultDeps: RtkGainDeps = { findBinary: () => findRtkBinary(), run: runRtk, now: () => Date.now() };

export function createRtkGainReader(overrides: Partial<RtkGainDeps> = {}): (root: string) => Promise<RtkGain> {
  const deps = { ...defaultDeps, ...overrides };
  const cache = new Map<string, { at: number; value: RtkGain }>();

  const collect = async (root: string): Promise<RtkGain> => {
    const readAt = new Date(deps.now()).toISOString();
    const binary = deps.findBinary();
    if (!binary) return { status: 'not-installed', version: null, gain: null, readAt };
    const version = await deps
      .run(binary, ['--version'], root, RTK_VERSION_TIMEOUT_MS)
      .then((out) => parseRtkVersion(`${out.stdout}${out.stderr}`))
      .catch(() => null);
    try {
      const parsed: unknown = JSON.parse((await deps.run(binary, GAIN_ARGS, root, RTK_GAIN_TIMEOUT_MS)).stdout);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { status: 'error', version, gain: null, readAt };
      }
      return { status: 'ok', version, gain: parsed as Record<string, unknown>, readAt };
    } catch {
      return { status: 'error', version, gain: null, readAt };
    }
  };

  return async (root) => {
    const hit = cache.get(root);
    if (hit && deps.now() - hit.at < RTK_CACHE_MS) return hit.value;
    const value = await collect(root);
    cache.set(root, { at: deps.now(), value });
    return value;
  };
}

export const readRtkGain = createRtkGainReader();
