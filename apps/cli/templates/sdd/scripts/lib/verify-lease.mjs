import {
  accessSync,
  closeSync,
  constants,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

export const LEASE_FILE_NAME = 'verify-full.lock';
export const LEASE_POLL_MS = 2000;
export const LEASE_DEFAULT_WAIT_S = 600;
export const LEASE_EXIT_CODE = 75;
const TAKEOVER_SUFFIX = '.takeover';
const UNREADABLE_GRACE_MS = 5000;

export function lockDirCandidates(env = process.env) {
  const candidates = [];
  if (env.SDD_VERIFY_LOCK_DIR) candidates.push(env.SDD_VERIFY_LOCK_DIR);
  candidates.push(join(homedir(), '.sdd-harness', 'locks'), join(tmpdir(), 'sdd-harness'));
  return candidates;
}

function isWritableDir(dir) {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveLockFile(env = process.env) {
  const dir = lockDirCandidates(env).find(isWritableDir);
  return dir ? join(dir, LEASE_FILE_NAME) : null;
}

export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function createExclusive(file, payload) {
  let fd;
  try {
    fd = openSync(file, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
  try {
    writeSync(fd, `${JSON.stringify(payload)}\n`);
  } finally {
    closeSync(fd);
  }
  return true;
}

function readOwner(file) {
  try {
    const owner = JSON.parse(readFileSync(file, 'utf8'));
    return owner && typeof owner === 'object' ? owner : null;
  } catch {
    return null;
  }
}

function ageMs(file) {
  try {
    return Date.now() - statSync(file).mtimeMs;
  } catch {
    return Infinity;
  }
}

function removeQuietly(file) {
  try {
    unlinkSync(file);
  } catch {
    return;
  }
}

function ownerIsLive(file, owner) {
  if (owner) return isPidAlive(owner.pid);
  return ageMs(file) < UNREADABLE_GRACE_MS;
}

function takeOverStale(file, payload) {
  const guard = `${file}${TAKEOVER_SUFFIX}`;
  if (!createExclusive(guard, { pid: process.pid })) {
    const guardOwner = readOwner(guard);
    if (!ownerIsLive(guard, guardOwner)) removeQuietly(guard);
    return { acquired: false, owner: readOwner(file) };
  }
  try {
    const current = readOwner(file);
    if (ownerIsLive(file, current)) return { acquired: false, owner: current };
    removeQuietly(file);
    if (createExclusive(file, payload)) return { acquired: true };
    return { acquired: false, owner: readOwner(file) };
  } finally {
    removeQuietly(guard);
  }
}

export function tryAcquire(file, info) {
  const payload = { pid: process.pid, ...info };
  if (createExclusive(file, payload)) return { acquired: true };
  const owner = readOwner(file);
  if (ownerIsLive(file, owner)) return { acquired: false, owner };
  return takeOverStale(file, payload);
}

export function releaseLease(file) {
  const owner = readOwner(file);
  if (owner && owner.pid !== process.pid) return false;
  removeQuietly(file);
  return true;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function acquireWithWait(file, info, { waitMs, pollMs = LEASE_POLL_MS, onBusy } = {}) {
  const deadline = Date.now() + waitMs;
  let informed = false;
  for (;;) {
    const attempt = tryAcquire(file, info);
    if (attempt.acquired) return { acquired: true };
    if (!informed) {
      informed = true;
      onBusy?.(attempt.owner);
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) return { acquired: false, owner: attempt.owner };
    await sleep(Math.min(pollMs, remaining));
  }
}

export function installReleaseHandlers(file, onSignal) {
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    releaseLease(file);
  };
  process.on('exit', release);
  for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
    process.on(signal, () => {
      onSignal?.();
      release();
      process.exit(code);
    });
  }
  return release;
}
