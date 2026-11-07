#!/usr/bin/env node
// Creates or switches to the branch of a cycle: pnpm sdd:branch <spec-id|slug> <cycle-XX> [--force] [--json]
// Exits 0 when the branch is ready (or the policy skips it), 1 when it cannot be, 2 on usage errors.
import { existsSync, readFileSync, realpathSync } from 'fs';
import { join, resolve } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { branchNameFor, branchPolicy } from './lib/github.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SDD = realpathSync(resolve(__dirname, '..'));
const REPO = resolve(SDD, '..');

const args = process.argv.slice(2);
const json = args.includes('--json');
const force = args.includes('--force');
const positional = args.filter((a) => !a.startsWith('--'));

if (args.includes('--help') || args.includes('-h') || positional.length === 0) {
  console.log(`Usage: pnpm sdd:branch <spec-id|slug> <cycle-XX> [--force] [--json]

  Creates (or switches to) the branch feat/<spec-slug>-cycle-XX of an open cycle.
  The branch per cycle follows sdd/global.json (profile team → on, solo → off, or github.branch_per_cycle).
  --force     → create the branch even when the policy is off
  --json      → structured output for agents

Exits 0 when the branch is ready or skipped by the policy, 1 when it cannot be created, 2 on a usage error.`);
  process.exit(positional.length === 0 && !args.includes('--help') && !args.includes('-h') ? 2 : 0);
}

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function finish(payload, code, message) {
  if (json) console.log(JSON.stringify(payload, null, 2));
  else if (message) (code === 0 ? console.log : console.error)(message);
  process.exit(code);
}

function fail(reason, code = 1) {
  finish({ ok: false, error: reason }, code, `[sdd:branch] ✗ ${reason}`);
}

const index = loadJson(join(SDD, 'specs', 'index.json'));
const specs = index?.specs ?? [];

function resolveSpec(query) {
  const exact = specs.find((s) => s.id === query);
  if (exact) return exact;
  const matches = specs.filter((s) => s.id.endsWith(`-${query}`) || s.id.includes(query));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) fail(`"${query}" is ambiguous: ${matches.map((s) => s.id).join(', ')}`, 2);
  return fail(`spec "${query}" is not in sdd/specs/index.json`, 2);
}

function normalizeCycle(raw) {
  const m = /^(?:cycle-)?(\d{1,2})$/.exec(raw ?? '');
  if (!m) fail(`invalid cycle "${raw}" — use cycle-XX`, 2);
  return `cycle-${m[1].padStart(2, '0')}`;
}

function git(...gitArgs) {
  const run = spawnSync('git', gitArgs, { cwd: REPO, encoding: 'utf8' });
  return { status: run.status ?? 1, out: (run.stdout ?? '').trim(), err: (run.stderr ?? '').trim(), missing: run.error?.code === 'ENOENT' };
}

if (positional.length < 2) fail('a spec needs its cycle: pnpm sdd:branch <spec> <cycle-XX>', 2);
const spec = resolveSpec(positional[0]);
const cycle = normalizeCycle(positional[1]);
const cycleJson = loadJson(join(REPO, spec.folder, 'cycles', cycle, 'cycle.json'));
if (cycleJson?.status !== 'in-progress') fail(`${spec.id} ${cycle} is not an open cycle (status in-progress)`);

const branch = branchNameFor(spec.id, cycle);
const policy = branchPolicy(loadJson(join(SDD, 'global.json')));

if (policy === 'off' && !force) {
  finish(
    { ok: true, skipped: true, branch, policy },
    0,
    `This project does not use a branch per cycle (policy: off). To create ${branch} anyway:\n  pnpm sdd:branch ${spec.id} ${cycle} --force`,
  );
}

const inside = git('rev-parse', '--is-inside-work-tree');
if (inside.missing) fail('git is not installed');
if (inside.status !== 0 || inside.out !== 'true' || !existsSync(join(REPO, '.git'))) {
  fail('this directory is not a git repository — run git init (or harness github connect) first');
}

const current = git('rev-parse', '--abbrev-ref', 'HEAD').out;
if (current === branch) finish({ ok: true, branch, created: false, switched: false, policy }, 0, `Already on ${branch}`);

const exists = git('rev-parse', '--verify', '--quiet', `refs/heads/${branch}`).status === 0;
const moved = exists ? git('switch', branch) : git('switch', '-c', branch);
if (moved.status !== 0) fail(`git could not move to ${branch}: ${moved.err || moved.out}`);

finish(
  { ok: true, branch, created: !exists, switched: true, policy },
  0,
  exists ? `Switched to existing branch ${branch}` : `Created and switched to ${branch}`,
);
