#!/usr/bin/env node
// Two-level verification as a command: pnpm sdd:verify <app> quick|full [options] | --init
// Exits 0 ok/reused, 1 a command failed, 2 usage, 3 no entry or empty level, 75 lease not obtained.
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEVELS,
  UNIT_RE,
  appIdsOf,
  buildResult,
  canReuse,
  commandLine,
  descendantsOf,
  expandFiles,
  formatDuration,
  inferEntry,
  isStandaloneTool,
  logicalIdsOf,
  nonSddPaths,
  normalizeCycleId,
  parseFilesOption,
  parseStatusZ,
  pickReusableCandidates,
  resolveEntryId,
  resultFileName,
  selectCycle,
  tailOf,
  whyNoEntry,
} from './lib/verify.mjs';
import {
  LEASE_DEFAULT_WAIT_S,
  LEASE_EXIT_CODE,
  acquireWithWait,
  installReleaseHandlers,
  resolveLockFile,
} from './lib/verify-lease.mjs';

const SDD = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const REPO = resolve(SDD, '..');
const VERIFY_FILE = join(SDD, 'verify.json');
const VALUE_FLAGS = new Set(['files', 'unit', 'spec', 'cycle', 'wait']);
const BOOLEAN_FLAGS = new Set(['reuse', 'verbose', 'json', 'init', 'help']);

const USAGE = `Usage: pnpm sdd:verify <app> quick [--files a,b] [--unit TASK-NNN]
       pnpm sdd:verify <app> full  [--unit B-NN] [--reuse] [--wait <seconds>]
       pnpm sdd:verify --init

  <app>      logical id (apps/billing-api) or bare name when unique
  quick      per-task commands; {files} is replaced by --files (command skipped without it)
  full       per-block commands; full_exclusive entries take the machine lease
  --reuse    (full) reuse a green full result when only sdd/ changed since its commit
  --spec <spec-id|slug> --cycle cycle-XX   pick the cycle that stores the result
  --verbose  stream the full output   --json  print only the result object
  --init     seed sdd/verify.json for subprojects without an entry

Exits 0 ok/reused, 1 a command failed, 2 usage, 3 no entry, 75 lease not obtained.`;

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
    else if (VALUE_FLAGS.has(name)) options[name] = inline ?? argv[++index];
    else return { error: `unknown option --${name}` };
  }
  return { options, positional };
}

const parsed = parseArgs(process.argv.slice(2));
const options = parsed.options ?? {};
const json = Boolean(options.json);

function say(line) {
  (json ? process.stderr : process.stdout).write(`${line}\n`);
}

function fail(code, message) {
  if (json) process.stdout.write(`${JSON.stringify({ error: message }, null, 2)}\n`);
  else process.stderr.write(`[sdd-verify] ✗ ${message}\n`);
  process.exit(code);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function git(args) {
  const run = spawnSync('git', ['-C', REPO, ...args], { encoding: 'utf8' });
  return run.status === 0 ? run.stdout : null;
}

function gitState() {
  const head = git(['rev-parse', 'HEAD']);
  const top = git(['rev-parse', '--show-toplevel']);
  if (head === null || top === null) return { commit: null, prefix: 'sdd/' };
  const rel = relative(top.trim(), SDD).split('\\').join('/');
  return { commit: head.trim(), prefix: rel ? `${rel}/` : '' };
}

function dirtyPaths() {
  const status = git(['status', '--porcelain', '-z', '-uall']);
  return status === null ? [] : parseStatusZ(status);
}

function changedBetween(commit) {
  const diff = git(['diff', '--name-only', commit, 'HEAD']);
  return diff === null ? null : diff.split('\n').filter(Boolean);
}

function cycleCandidates() {
  const index = readJson(join(SDD, 'specs', 'index.json'));
  const out = [];
  for (const spec of index?.specs ?? []) {
    const cyclesDir = join(REPO, spec.folder, 'cycles');
    if (!existsSync(cyclesDir)) continue;
    for (const id of readdirSync(cyclesDir).filter((name) => /^cycle-\d{2}$/.test(name)).sort()) {
      const data = readJson(join(cyclesDir, id, 'cycle.json'));
      if (data) out.push({ spec: spec.id, cycle: id, status: data.status, apps: data.apps, dir: join(cyclesDir, id) });
    }
  }
  return out;
}

function resolveCycle(appId) {
  const cycle = options.cycle ? normalizeCycleId(options.cycle) : undefined;
  if (options.cycle && !cycle) fail(2, `invalid cycle "${options.cycle}" — use cycle-XX`);
  return selectCycle(cycleCandidates(), { app: appId, spec: options.spec, cycle });
}

function loadResults(verifyDir) {
  if (!existsSync(verifyDir)) return [];
  return readdirSync(verifyDir)
    .filter((name) => name.endsWith('-full.json'))
    .map((name) => ({ ...readJson(join(verifyDir, name)), file: join(verifyDir, name) }));
}

function findReusable(verifyDir, appId, state) {
  const dirtyNow = dirtyPaths();
  for (const previous of pickReusableCandidates(loadResults(verifyDir), appId)) {
    const changedSincePrevious = previous.commit ? changedBetween(previous.commit) : null;
    if (state.commit && canReuse(previous, { app: appId, changedSincePrevious, dirtyNow, prefix: state.prefix })) return previous;
  }
  return null;
}

function ensureLogDir(verifyDir) {
  const logs = join(verifyDir, 'logs');
  mkdirSync(logs, { recursive: true });
  writeFileSync(join(logs, '.gitignore'), '*\n', 'utf8');
  return logs;
}

let activeChild = null;

function childPidsOf(pid) {
  const run = spawnSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' });
  return run.status === 0 ? run.stdout.split('\n').filter(Boolean).map(Number) : [];
}

function signalQuietly(pid, signal) {
  try {
    process.kill(pid, signal);
  } catch {
    return;
  }
}

function killActiveTree() {
  const pid = activeChild?.pid;
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      return;
    }
    for (const target of [...descendantsOf(pid, childPidsOf), pid]) signalQuietly(target, 'SIGTERM');
  } catch {
    activeChild?.kill();
  }
}

function runCommand(command, logPath) {
  return new Promise((resolveRun) => {
    const started = Date.now();
    const log = createWriteStream(logPath);
    let tail = '';
    const child = spawn(command, { shell: true, cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    activeChild = child;
    const collect = (sink) => (chunk) => {
      log.write(chunk);
      tail = (tail + chunk.toString()).slice(-65536);
      if (options.verbose) sink.write(chunk);
    };
    child.stdout.on('data', collect(process.stdout));
    child.stderr.on('data', collect(process.stderr));
    const finish = (exitCode) => {
      activeChild = null;
      log.end(() => resolveRun({ exit_code: exitCode, duration_ms: Date.now() - started, tail }));
    };
    child.on('error', (error) => {
      tail += `${error.message}\n`;
      finish(127);
    });
    child.on('close', (code) => finish(code ?? 1));
  });
}

async function runLevel({ commands, files, logDir, label }) {
  const results = [];
  for (const [index, template] of commands.entries()) {
    const expanded = expandFiles(template, files);
    if (expanded === null) {
      results.push({ command: template, exit_code: 0, duration_ms: 0, skipped: true });
      say(commandLine(results[results.length - 1]));
      continue;
    }
    const logPath = join(logDir, `${label}-${index + 1}.log`);
    const outcome = await runCommand(expanded, logPath);
    const result = { command: expanded, exit_code: outcome.exit_code, duration_ms: outcome.duration_ms, skipped: false };
    results.push(result);
    say(commandLine(result));
    if (outcome.exit_code !== 0) {
      if (!options.verbose) say(`${tailOf(outcome.tail)}\nfull log: ${relative(REPO, logPath).split('\\').join('/')}`);
      break;
    }
  }
  return results;
}

function describeOwner(owner) {
  if (!owner) return 'another process';
  const details = [owner.repo, owner.app, owner.started_at && `since ${owner.started_at}`].filter(Boolean);
  return `pid ${owner.pid} (${details.join(' · ')})`;
}

async function takeLease(appId) {
  const file = resolveLockFile();
  if (!file) {
    say('⚠ no writable lease location — running without the machine lease');
    return;
  }
  const waitS = options.wait === undefined ? LEASE_DEFAULT_WAIT_S : Number(options.wait);
  if (!Number.isFinite(waitS) || waitS < 0) fail(2, `invalid --wait "${options.wait}"`);
  const info = { repo: REPO, app: appId, started_at: new Date().toISOString() };
  const outcome = await acquireWithWait(file, info, {
    waitMs: waitS * 1000,
    onBusy: (owner) => say(`waiting for the full-verify lease held by ${describeOwner(owner)}`),
  });
  if (!outcome.acquired) {
    fail(LEASE_EXIT_CODE, `lease still held by ${describeOwner(outcome.owner)} after ${waitS}s — report it instead of forcing`);
  }
  installReleaseHandlers(file, killActiveTree);
}

function initEntries() {
  const globalJson = readJson(join(SDD, 'global.json'));
  const config = readJson(VERIFY_FILE) ?? { $schema: './schemas/verify.schema.json' };
  const nx = existsSync(join(REPO, 'nx.json'));
  const rootPackageJson = readJson(join(REPO, 'package.json'));
  const added = [];
  for (const id of logicalIdsOf(globalJson)) {
    if (id in config) continue;
    const dir = join(REPO, id);
    const name = id.slice(id.indexOf('/') + 1);
    const projectJson = readJson(join(dir, 'project.json'));
    const facts = {
      id,
      name: projectJson?.name ?? name,
      nx,
      hasProjectJson: projectJson !== null,
      packageJson: readJson(join(dir, 'package.json')),
      rootPackageJson,
      hasDir: existsSync(dir),
      standalone: isStandaloneTool(globalJson?.monorepo?.tool),
    };
    const entry = inferEntry(facts);
    if (!entry) {
      say(`– ${id}: ${whyNoEntry(facts)}`);
      continue;
    }
    config[id] = entry;
    added.push(id);
    say(`+ ${id}: quick ${entry.quick?.length ?? 0} · full ${entry.full?.length ?? 0}${entry.full_exclusive ? ' · exclusive' : ''}`);
  }
  if (added.length) writeJson(VERIFY_FILE, config);
  else say('nothing to add');
}

function resolveLevelCommands(config, appId, level) {
  const commands = config[appId]?.[level] ?? [];
  if (commands.length === 0) {
    fail(3, `${appId} has no "${level}" commands in sdd/verify.json — run: pnpm sdd:verify --init`);
  }
  return commands;
}

async function main() {
  if (parsed.error) fail(2, `${parsed.error}\n${USAGE}`);
  if (options.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (options.init) {
    initEntries();
    return;
  }
  const [appQuery, level] = parsed.positional;
  if (!appQuery || !LEVELS.includes(level)) fail(2, `<app> and a level (quick|full) are required\n${USAGE}`);
  if (options.reuse && level !== 'full') fail(2, '--reuse applies to the full level only');
  if (options.unit && !UNIT_RE.test(options.unit)) fail(2, `invalid --unit "${options.unit}" — use TASK-NNN or B-NN`);

  const config = readJson(VERIFY_FILE);
  if (!config) fail(3, 'sdd/verify.json is missing or invalid — run: pnpm sdd:verify --init');
  const entryRef = resolveEntryId(config, appQuery);
  if (entryRef.error === 'ambiguous') fail(2, `"${appQuery}" is ambiguous: ${entryRef.candidates.join(', ')}`);
  if (entryRef.error === 'missing') {
    fail(3, `no entry for "${appQuery}" in sdd/verify.json (${appIdsOf(config).join(', ') || 'empty'}) — run: pnpm sdd:verify --init`);
  }
  const appId = entryRef.id;
  const commands = resolveLevelCommands(config, appId, level);

  const { cycle, reason } = resolveCycle(appId);
  if (!cycle && (options.spec || options.cycle)) fail(2, `no cycle matches --spec/--cycle (${reason})`);
  if (!cycle) say(`⚠ no cycle resolved (${reason}) — result will not be persisted`);
  const verifyDir = cycle ? join(cycle.dir, 'artifacts', 'verify') : null;
  const state = gitState();

  if (options.reuse && verifyDir) {
    const reusable = findReusable(verifyDir, appId, state);
    if (reusable) {
      const rel = relative(REPO, reusable.file).split('\\').join('/');
      if (json) process.stdout.write(`${JSON.stringify({ ...reusable, file: undefined, reused: rel }, null, 2)}\n`);
      else say(`reused ${rel}`);
      return;
    }
  }

  if (level === 'full' && config[appId].full_exclusive === true) await takeLease(appId);

  const logDir = verifyDir ? ensureLogDir(verifyDir) : join(tmpdir(), 'sdd-harness', 'verify-logs');
  mkdirSync(logDir, { recursive: true });
  const unit = options.unit;
  const dirty = nonSddPaths(dirtyPaths(), state.prefix);
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const results = await runLevel({
    commands,
    files: parseFilesOption(options.files),
    logDir,
    label: `${unit ?? 'cycle'}-${level}`,
  });
  const result = buildResult({
    app: appId,
    level,
    unit,
    commit: state.commit,
    dirty,
    startedAt,
    durationMs: Date.now() - started,
    commands: results,
  });
  let persistedAt = null;
  if (verifyDir) {
    persistedAt = join(verifyDir, resultFileName(unit, level));
    writeJson(persistedAt, result);
  }
  if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    const where = persistedAt ? ` → ${relative(REPO, persistedAt).split('\\').join('/')}` : '';
    say(`verify ${appId} ${level} ${result.ok ? 'OK' : 'FAILED'} ${formatDuration(result.duration_ms)}${where}`);
  }
  process.exitCode = result.ok ? 0 : 1;
}

main().catch((error) => fail(1, error.message));
