import { readFile, stat } from 'node:fs/promises';
import { hostname } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { VerifyLeaseSummary } from '@sdd-studio/protocol';

export const VERIFY_LEASE_MODULE = ['sdd', 'scripts', 'lib', 'verify-lease.mjs'];

interface LeaseOwner {
  pid?: unknown;
  host?: unknown;
  repo?: unknown;
  app?: unknown;
  started_at?: unknown;
}

interface VerifyLeaseLib {
  resolveLockFile(env?: NodeJS.ProcessEnv): string | null;
  judgeLease(input: { owner: LeaseOwner | null; ageMs: number; host: string; pidAlive: boolean }): string;
  isPidAlive(pid: number): boolean;
}

const isLib = (value: unknown): value is VerifyLeaseLib => {
  const lib = value as Partial<Record<keyof VerifyLeaseLib, unknown>> | null;
  return !!lib && (['resolveLockFile', 'judgeLease', 'isPidAlive'] as const).every((name) => typeof lib[name] === 'function');
};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export async function readVerifyLease(root: string, env: NodeJS.ProcessEnv = process.env): Promise<VerifyLeaseSummary | null> {
  let lib: VerifyLeaseLib;
  try {
    const module: unknown = await import(/* @vite-ignore */ pathToFileURL(path.join(root, ...VERIFY_LEASE_MODULE)).href);
    if (!isLib(module)) return null;
    lib = module;
  } catch {
    return null;
  }
  try {
    const file = lib.resolveLockFile(env);
    if (!file) return null;
    const [info, raw] = await Promise.all([stat(file), readFile(file, 'utf8')]);
    const owner = JSON.parse(raw) as LeaseOwner | null;
    if (!owner || typeof owner !== 'object' || typeof owner.pid !== 'number') return null;
    const host = text(owner.host);
    const verdict = lib.judgeLease({
      owner,
      ageMs: Date.now() - info.mtimeMs,
      host: hostname(),
      pidAlive: host === hostname() ? lib.isPidAlive(owner.pid) : true,
    });
    return {
      app: text(owner.app).slice(0, 120),
      repo: text(owner.repo).slice(0, 1024),
      host: host.slice(0, 256),
      pid: Math.max(0, Math.trunc(owner.pid)),
      startedAt: text(owner.started_at),
      state: verdict === 'live' ? 'live' : verdict === 'dead' ? 'dead' : 'stale',
    };
  } catch {
    return null;
  }
}
