#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  listLiveLeases,
  normalizeRel,
  notifyRequesters,
  releaseLease,
  resolveRegistryDir,
  toPosix,
  unitKey,
} from './lib/session-registry.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO = realpathSync(resolve(__dirname, '..', '..'));
const CALLER_DIR = realOf(process.env.INIT_CWD ?? process.cwd());

function realOf(path) {
  return existsSync(path) ? realpathSync(path) : path;
}

const nodeFs = {
  read: async (path) => readFileSync(path, 'utf8'),
  write: async (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, 'utf8');
  },
  list: async (path) => readdirSync(path, { withFileTypes: true }).map((entry) => ({ name: entry.name })),
};

const args = process.argv.slice(2);
const json = args.includes('--json');
const list = args.includes('--list');
const positional = args.filter((a) => !a.startsWith('--'));

if (args.includes('--help') || args.includes('-h') || (!list && positional.length === 0)) {
  console.log(`Usage: pnpm sdd:release <file…> [--json]
       pnpm sdd:release --list [--json]

  Releases the file reservations that SDD sessions take when they edit code, and tells the
  sessions that asked for those files that they are free.
  --list      → show the live reservations instead
  --json      → structured output for agents

Exits 0 when something was released (or listed), 1 when no given file was reserved, 2 on a usage error.`);
  process.exit(!list && positional.length === 0 && !args.includes('--help') && !args.includes('-h') ? 2 : 0);
}

function relToRepo(input) {
  const absolute = realOf(isAbsolute(input) ? input : resolve(CALLER_DIR, input));
  const rel = toPosix(relative(REPO, absolute));
  if (rel === '' || rel.startsWith('../') || isAbsolute(rel)) return null;
  return normalizeRel(rel);
}

function describe(lease) {
  return `${lease.path} — ${lease.unit ? unitKey(lease.unit) : 'sin unidad'} · ${lease.harness} · ${lease.session_id}`;
}

const now = Date.now();
const dir = await resolveRegistryDir(nodeFs, toPosix(REPO));

if (list) {
  const leases = await listLiveLeases(nodeFs, dir, now);
  if (json) console.log(JSON.stringify({ ok: true, leases }, null, 2));
  else console.log(leases.length ? leases.map(describe).join('\n') : 'No file is reserved.');
  process.exit(0);
}

const released = [];
const missing = [];
const outside = [];
for (const input of positional) {
  const rel = relToRepo(input);
  if (rel === null) {
    outside.push(input);
    continue;
  }
  const lease = await releaseLease(nodeFs, dir, rel, now);
  if (!lease) {
    missing.push(rel);
    continue;
  }
  const notified = await notifyRequesters(nodeFs, dir, lease, now).catch(() => []);
  released.push({ path: lease.path, session: lease.session_id, unit: lease.unit, notified });
}

if (outside.length && !released.length && !missing.length) {
  if (json) console.log(JSON.stringify({ ok: false, error: 'outside the repository', outside }, null, 2));
  else console.error(`[sdd:release] ✗ outside the repository: ${outside.join(', ')}`);
  process.exit(2);
}

if (json) console.log(JSON.stringify({ ok: released.length > 0, released, missing, outside }, null, 2));
else {
  for (const item of released) {
    const told = item.notified.length ? ` · notified: ${item.notified.join(', ')}` : '';
    console.log(`Released ${item.path} (${item.unit ? unitKey(item.unit) : 'sin unidad'})${told}`);
  }
  for (const rel of missing) console.error(`[sdd:release] ${rel} was not reserved`);
  for (const input of outside) console.error(`[sdd:release] ${input} is outside the repository`);
}
process.exit(released.length > 0 ? 0 : 1);
