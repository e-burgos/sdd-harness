import {
  accessSync,
  closeSync,
  constants,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  utimesSync,
  writeSync,
} from 'node:fs';
import { homedir, hostname, tmpdir } from 'node:os';
import { join } from 'node:path';

export const LEASE_FILE_NAME = 'verify-full.lock';
export const LEASE_POLL_MS = 2000;
export const LEASE_DEFAULT_WAIT_S = 600;
export const LEASE_EXIT_CODE = 75;
const TAKEOVER_SUFFIX = '.takeover';
const UNREADABLE_GRACE_MS = 5000;
export const HEARTBEAT_MS = 15000;
export const STALE_AFTER_MS = 90000;

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

function modifiedAt(file) {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return null;
  }
}

function removeQuietly(file) {
  try {
    unlinkSync(file);
  } catch {
    return;
  }
}

export function judgeLease({ owner, ageMs: age, host, pidAlive }) {
  if (!owner) return age < UNREADABLE_GRACE_MS ? 'live' : 'stale-heartbeat';
  if (owner.host === host && !pidAlive) return 'dead';
  return age > STALE_AFTER_MS ? 'stale-heartbeat' : 'live';
}

function judgeFile(file, owner) {
  return judgeLease({
    owner,
    ageMs: ageMs(file),
    host: hostname(),
    pidAlive: owner ? isPidAlive(owner.pid) : false,
  });
}

const signatureOf = (file, owner) => `${owner?.pid}:${owner?.started_at}:${modifiedAt(file)}`;

function takeOverStale(file, payload, expectedSignature) {
  const guard = `${file}${TAKEOVER_SUFFIX}`;
  if (!createExclusive(guard, { pid: process.pid, host: hostname() })) {
    const guardOwner = readOwner(guard);
    if (judgeFile(guard, guardOwner) !== 'live') removeQuietly(guard);
    return { acquired: false, owner: readOwner(file) };
  }
  try {
    const current = readOwner(file);
    const verdict = judgeFile(file, current);
    if (verdict === 'live') return { acquired: false, owner: current };
    if (verdict === 'stale-heartbeat' && signatureOf(file, current) !== expectedSignature) {
      return { acquired: false, owner: current };
    }
    removeQuietly(file);
    if (createExclusive(file, payload)) return { acquired: true };
    return { acquired: false, owner: readOwner(file) };
  } finally {
    removeQuietly(guard);
  }
}

export function tryAcquire(file, info, { suspect } = {}) {
  const payload = { pid: process.pid, host: hostname(), ...info };
  if (createExclusive(file, payload)) return { acquired: true };
  const owner = readOwner(file);
  const verdict = judgeFile(file, owner);
  if (verdict === 'live') return { acquired: false, owner };
  const signature = signatureOf(file, owner);
  if (verdict === 'dead') return takeOverStale(file, payload, signature);
  if (signature !== suspect) return { acquired: false, owner, suspect: signature };
  const outcome = takeOverStale(file, payload, signature);
  return outcome.acquired ? outcome : { ...outcome, suspect: undefined };
}

export function releaseLease(file) {
  const owner = readOwner(file);
  if (!owner || owner.pid !== process.pid || owner.host !== hostname()) return false;
  removeQuietly(file);
  return true;
}

export function startHeartbeat(file, intervalMs = HEARTBEAT_MS) {
  const timer = setInterval(() => {
    try {
      const now = new Date();
      utimesSync(file, now, now);
    } catch {
      return;
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function acquireWithWait(file, info, { waitMs, pollMs = LEASE_POLL_MS, onBusy } = {}) {
  const deadline = Date.now() + waitMs;
  let informed = false;
  let suspect;
  let confirmed = false;
  for (;;) {
    const attempt = tryAcquire(file, info, { suspect });
    if (attempt.acquired) return { acquired: true };
    suspect = attempt.suspect;
    if (!informed) {
      informed = true;
      onBusy?.(attempt.owner);
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      if (suspect === undefined || confirmed) return { acquired: false, owner: attempt.owner };
      confirmed = true;
      await sleep(pollMs);
      continue;
    }
    await sleep(Math.min(pollMs, remaining));
  }
}

export function holdLease(file) {
  let released = false;
  const stopHeartbeat = startHeartbeat(file);
  const release = () => {
    if (released) return;
    released = true;
    stopHeartbeat();
    releaseLease(file);
  };
  process.on('exit', release);
  return release;
}
