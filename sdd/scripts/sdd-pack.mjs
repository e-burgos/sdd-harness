#!/usr/bin/env node
// Context pack for an agent role: pnpm sdd:pack <spec-id|slug> cycle-XX <role> [B-NN | TASK-NNN[,…]] [--app id] [--stdout]
// Also: pnpm sdd:pack <spec> cycle-XX --stats [--json]. Exits 0 ok, 2 usage / unknown spec, cycle or unit, 3 no packs.json or role entry.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROLE_NAME_RE,
  approxKTokens,
  buildPack,
  createContext,
  packFileName,
  packNeedsApp,
  parseUnitArg,
  resolveApp,
  resolveUnit,
  statsUnits,
  taskEntries,
  summaryLine,
  topPackMisses,
} from './lib/pack.mjs';
import { normalizeCycleRef, resolveSpecRef } from './lib/task-registry.mjs';

const SDD = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const REPO = resolve(SDD, '..');
const PACKS_FILE = join(SDD, 'packs.json');
const VALUE_FLAGS = new Set(['app']);
const BOOLEAN_FLAGS = new Set(['stdout', 'stats', 'json', 'help']);

const USAGE = `Usage: pnpm sdd:pack <spec-id|slug> cycle-XX <role> [B-NN | TASK-NNN[,TASK-NNN…]] [--app <id>] [--stdout]
       pnpm sdd:pack <spec-id|slug> cycle-XX --stats [--json] [--app <id>]

  Writes sdd/specs/<spec>/cycles/cycle-XX/artifacts/packs/<unit>.<role>.md (derived, git-ignored).
  --stdout  print the pack instead of writing it   --stats  size of every possible pack, writes nothing

Exits 0 ok, 2 usage or unknown spec/cycle/unit, 3 no packs.json or no entry for the role.`;

function parseArgs(argv) {
  const options = {};
  const positional = [];
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const [name, inline] = token.slice(2).split(/=(.*)/s);
    if (BOOLEAN_FLAGS.has(name)) options[name] = true;
    else if (VALUE_FLAGS.has(name)) {
      const value = inline ?? (argv[index + 1]?.startsWith('--') ? undefined : argv[++index]);
      if (value === undefined) return { error: `--${name} needs a value` };
      options[name] = value;
    } else return { error: `unknown option --${name}` };
  }
  return { options, positional };
}

const parsed = parseArgs(process.argv.slice(2));
const options = parsed.options ?? {};

function fail(code, message) {
  process.stderr.write(`[sdd-pack] ✗ ${message}\n`);
  process.exit(code);
}

const posix = (path) => path.split('\\').join('/');

const io = {
  read(path) {
    try {
      return readFileSync(join(REPO, path));
    } catch {
      return null;
    }
  },
  list(path) {
    try {
      return readdirSync(join(REPO, path), { withFileTypes: true }).map((entry) => ({ name: entry.name, dir: entry.isDirectory() }));
    } catch {
      return [];
    }
  },
};

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function loadPacks() {
  if (!existsSync(PACKS_FILE)) fail(3, 'sdd/packs.json is missing — the agent works without a pack');
  const packs = readJson(PACKS_FILE);
  if (!packs || typeof packs !== 'object' || typeof packs.roles !== 'object' || packs.roles === null) fail(2, 'sdd/packs.json is not valid — fix it first');
  return packs;
}

function checkPositionals() {
  const limit = options.stats ? 2 : 4;
  if (parsed.positional.length <= limit) return;
  const extra = parsed.positional.slice(limit).join(' ');
  fail(2, `unexpected extra argument(s): ${extra} — join tasks with a comma and no spaces (TASK-001,TASK-002)\n${USAGE}`);
}

function locateCycle() {
  checkPositionals();
  const [specQuery, cycleQuery] = parsed.positional;
  const cycleId = normalizeCycleRef(cycleQuery);
  if (!specQuery || !cycleId) fail(2, `<spec> and cycle-XX are required\n${USAGE}`);
  const index = readJson(join(SDD, 'specs', 'index.json'));
  if (!index) fail(2, 'sdd/specs/index.json is missing or invalid');
  const resolved = resolveSpecRef(index.specs ?? [], specQuery);
  if (resolved.error) fail(2, resolved.error);
  const specId = resolved.spec.id;
  const specFolder = posix(resolved.spec.folder);
  const cycleDir = `${specFolder}/cycles/${cycleId}`;
  if (!existsSync(join(REPO, cycleDir, 'cycle.json'))) fail(2, `${cycleDir}/cycle.json does not exist`);
  return { specId, specFolder, cycleId, cycleDir };
}

function newContext(location, unit, app, packs) {
  return createContext({
    io,
    ...location,
    unit,
    app,
    limits: packs.limits,
    contextAlways: packs.context_always,
    now: new Date().toISOString(),
  });
}

function appFailure(app, cycleApps) {
  const list = (cycleApps ?? []).join(', ') || '(the cycle declares no apps)';
  fail(2, `${app.error ?? 'the app cannot be decided'} — pass --app <id>: ${list}`);
}

function runPack(location, packs) {
  const [, , role, unitArg] = parsed.positional;
  if (!role || !ROLE_NAME_RE.test(role)) fail(2, `a role is required (or --stats)\n${USAGE}`);
  const roleDef = packs.roles[role];
  if (!roleDef || typeof roleDef !== 'object') fail(3, `sdd/packs.json has no entry for role "${role}" (${Object.keys(packs.roles).join(', ') || 'empty'})`);
  const tasksJson = readJson(join(REPO, location.cycleDir, 'tasks.json'));
  const cycleJson = readJson(join(REPO, location.cycleDir, 'cycle.json'));
  let unit;
  if (roleDef.unit === 'batch') {
    if (!unitArg) fail(2, `role "${role}" works on a unit — pass B-NN or TASK-NNN[,TASK-NNN…]`);
    const request = parseUnitArg(unitArg);
    if (request.error) fail(2, request.error);
    const resolved = resolveUnit(tasksJson, request);
    if (resolved.error) fail(2, resolved.error);
    unit = resolved.unit;
  } else {
    if (unitArg) fail(2, `role "${role}" works on the whole cycle and takes no unit`);
    unit = { id: 'cycle', kind: 'cycle', taskIds: [], app: null };
  }
  const include = Array.isArray(roleDef.include) ? roleDef.include : [];
  const decided = resolveApp({ requested: options.app, unitApp: unit.app, cycleApps: cycleJson?.apps });
  if (decided.error || (!decided.app && packNeedsApp(include))) appFailure(decided, cycleJson?.apps);
  const ctx = newContext(location, unit, decided.app, packs);
  const result = buildPack({ ctx, role, include });
  if (options.stdout) {
    process.stdout.write(result.text);
    process.stderr.write(`${summaryLine('(stdout)', result)}\n`);
    return;
  }
  const dir = join(REPO, location.cycleDir, 'artifacts', 'packs');
  mkdirSync(dir, { recursive: true });
  const ignore = join(dir, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n', 'utf8');
  const file = join(dir, packFileName(unit.id, role));
  writeFileSync(file, result.text, 'utf8');
  process.stdout.write(`${summaryLine(posix(relative(REPO, file)), result)}\n`);
}

function statsRows(location, packs) {
  const tasksJson = readJson(join(REPO, location.cycleDir, 'tasks.json'));
  const cycleJson = readJson(join(REPO, location.cycleDir, 'cycle.json'));
  const rows = [];
  for (const [role, roleDef] of Object.entries(packs.roles)) {
    const include = Array.isArray(roleDef?.include) ? roleDef.include : [];
    const roleRows = [];
    const units = statsUnits({ tasksJson, roleDef, role });
    for (const unit of units) {
      const decided = resolveApp({ requested: options.app, unitApp: unit.app, cycleApps: cycleJson?.apps });
      if (decided.error) appFailure(decided, cycleJson?.apps);
      if (!decided.app && packNeedsApp(include)) {
        roleRows.push({ role, unit: unit.id, pack_bytes: 0, source_bytes: 0, reason: 'needs --app' });
        continue;
      }
      const ctx = newContext(location, unit, decided.app, packs);
      const result = buildPack({ ctx, role, include });
      roleRows.push({
        role,
        unit: unit.id,
        pack_bytes: result.packBytes,
        source_bytes: result.sourceBytes,
        reason: result.oversize ? `over max_pack_bytes (${ctx.limits.max_pack_bytes})` : 'ok',
      });
    }
    const perTask = units.length > 1 && units.every((unit) => unit.kind === 'tasks');
    if (perTask) {
      const heaviest = roleRows.reduce((best, row) => (row.pack_bytes > best.pack_bytes ? row : best), roleRows[0]);
      rows.push({ ...heaviest, reason: `heaviest of ${units.length} tasks; ${heaviest.reason}` });
    } else rows.push(...roleRows);
  }
  if (rows.some((row) => row.reason === 'needs --app')) appFailure({}, cycleJson?.apps);
  return { rows, tasks: taskEntries(tasksJson) };
}

function runStats(location, packs) {
  const { rows, tasks } = statsRows(location, packs);
  const total = {
    pack_bytes: rows.reduce((sum, row) => sum + row.pack_bytes, 0),
    source_bytes: rows.reduce((sum, row) => sum + row.source_bytes, 0),
  };
  const misses = topPackMisses(tasks);
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ rows, total, pack_misses: misses }, null, 2)}\n`);
    return;
  }
  const lines = rows.map(
    (row) => `${row.role} ${row.unit} · pack ${row.pack_bytes} bytes (~${approxKTokens(row.pack_bytes)}k) · sources ${row.source_bytes} bytes · ${row.reason}`,
  );
  lines.push(`total · pack ${total.pack_bytes} bytes · sources ${total.source_bytes} bytes · ${rows.length} packs`);
  if (misses.length) lines.push(`pack-misses: ${misses.map((miss) => `${miss.path} ×${miss.count}`).join(', ')}`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

function main() {
  if (parsed.error) fail(2, `${parsed.error}\n${USAGE}`);
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  const location = locateCycle();
  const packs = loadPacks();
  if (options.stats) runStats(location, packs);
  else runPack(location, packs);
}

try {
  main();
} catch (error) {
  fail(2, `unexpected error: ${String(error?.message ?? error).split('\n')[0]}`);
}
