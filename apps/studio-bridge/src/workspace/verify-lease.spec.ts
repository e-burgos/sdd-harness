import { cp, mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readVerifyLease } from './verify-lease';

const KIT_LEASE = fileURLToPath(new URL('../../../cli/templates/sdd/scripts/lib/verify-lease.mjs', import.meta.url));

let root: string;
let lockDir: string;
let env: NodeJS.ProcessEnv;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'verify-lease-root-'));
  lockDir = await mkdtemp(path.join(tmpdir(), 'verify-lease-lock-'));
  env = { SDD_VERIFY_LOCK_DIR: lockDir };
  await mkdir(path.join(root, 'sdd', 'scripts', 'lib'), { recursive: true });
  await cp(KIT_LEASE, path.join(root, 'sdd', 'scripts', 'lib', 'verify-lease.mjs'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(lockDir, { recursive: true, force: true });
});

const lockFile = () => path.join(lockDir, 'verify-full.lock');
const writeLock = (owner: Record<string, unknown>) => writeFile(lockFile(), `${JSON.stringify(owner)}\n`);
const owner = { pid: process.pid, host: hostname(), repo: '/r', app: 'libs/x', started_at: '2026-11-20T10:00:00.000Z' };

describe('readVerifyLease', () => {
  it('reports a live lease held by a running process', async () => {
    await writeLock(owner);
    expect(await readVerifyLease(root, env)).toEqual({
      app: 'libs/x', repo: '/r', host: hostname(), pid: process.pid, startedAt: owner.started_at, state: 'live',
    });
  });

  it('reports stale when the heartbeat is older than 90 seconds', async () => {
    await writeLock({ ...owner, host: 'other-host' });
    const old = new Date(Date.now() - 120_000);
    await utimes(lockFile(), old, old);
    expect(await readVerifyLease(root, env)).toMatchObject({ state: 'stale', host: 'other-host' });
  });

  it('reports dead when the owner pid is gone on this host', async () => {
    await writeLock({ ...owner, pid: 2_147_483_000 });
    expect(await readVerifyLease(root, env)).toMatchObject({ state: 'dead' });
  });

  it('is null without a lock file', async () => {
    expect(await readVerifyLease(root, env)).toBeNull();
  });

  it('is null without the kit lib', async () => {
    await writeLock(owner);
    await rm(path.join(root, 'sdd', 'scripts', 'lib', 'verify-lease.mjs'));
    expect(await readVerifyLease(root, env)).toBeNull();
  });

  it('is null for an unreadable lock', async () => {
    await writeFile(lockFile(), 'not json');
    expect(await readVerifyLease(root, env)).toBeNull();
  });
});
