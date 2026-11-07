#!/usr/bin/env node
// Opens the pull request of a cycle: pnpm sdd:pr <spec-id|slug> <cycle-XX> [--yes] [--json]
// Without --yes it only prints the plan. Exits 0 when planned or opened, 1 when it cannot be, 2 on usage errors.
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { branchNameFor, defaultBranchOf, prBodyFor, prTitleFor } from './lib/github.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SDD = realpathSync(resolve(__dirname, '..'));
const REPO = resolve(SDD, '..');

const args = process.argv.slice(2);
const json = args.includes('--json');
const yes = args.includes('--yes');
const positional = args.filter((a) => !a.startsWith('--'));

if (args.includes('--help') || args.includes('-h') || positional.length === 0) {
  console.log(`Usage: pnpm sdd:pr <spec-id|slug> <cycle-XX> [--yes] [--json]

  Builds the pull request of a cycle (branch feat/<spec-slug>-cycle-XX → default branch) from its cycle.json.
  Without --yes it prints the plan and changes nothing. With --yes it pushes the branch and runs gh pr create
  (it needs the GitHub CLI: gh auth login).
  --yes       → push the branch and open the pull request
  --json      → structured output for agents

Exits 0 when planned or opened, 1 when it cannot be opened, 2 on a usage error.`);
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
  finish({ ok: false, error: reason }, code, `[sdd:pr] ✗ ${reason}`);
}

const specs = loadJson(join(SDD, 'specs', 'index.json'))?.specs ?? [];

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

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: REPO, encoding: 'utf8' });
  return {
    status: result.status ?? 1,
    out: (result.stdout ?? '').trim(),
    err: (result.stderr ?? '').trim(),
    missing: result.error?.code === 'ENOENT',
  };
}

if (positional.length < 2) fail('a spec needs its cycle: pnpm sdd:pr <spec> <cycle-XX>', 2);
const spec = resolveSpec(positional[0]);
const cycle = normalizeCycle(positional[1]);
const cycleJson = loadJson(join(REPO, spec.folder, 'cycles', cycle, 'cycle.json'));
if (!cycleJson) fail(`${spec.id} ${cycle} has no cycle.json`);

const branch = branchNameFor(spec.id, cycle);
const base = defaultBranchOf(loadJson(join(SDD, 'global.json')));
const title = prTitleFor({
  specId: spec.id,
  specTitle: spec.title ?? spec.slug ?? spec.id,
  module: cycleJson.module ?? spec.module,
  cycle,
});
const body = prBodyFor({ specId: spec.id, cycle, cycleJson });
const plan = { branch, base, title, body };

if (!yes) {
  finish(
    { ok: false, needsConfirmation: true, plan },
    0,
    `Pull request plan\n  branch: ${branch}\n  base:   ${base}\n  title:  ${title}\n\n${body}\n\nTo push the branch and open it:\n  pnpm sdd:pr ${spec.id} ${cycle} --yes`,
  );
}

const ghVersion = run('gh', ['--version']);
if (ghVersion.missing || ghVersion.status !== 0) {
  fail('the GitHub CLI (gh) is not available — install it from https://cli.github.com and run gh auth login');
}

if (!existsSync(join(REPO, '.git'))) fail('this directory is not a git repository');
const current = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).out;
const exists = run('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]).status === 0;
if (current !== branch && !exists) {
  fail(`the branch ${branch} does not exist — run pnpm sdd:branch ${spec.id} ${cycle} --force first`);
}

const existing = run('gh', ['pr', 'view', branch, '--json', 'url']);
if (existing.status === 0) {
  let url = null;
  try {
    url = JSON.parse(existing.out).url ?? null;
  } catch {
    url = null;
  }
  if (url) finish({ ok: true, url, created: false }, 0, `The pull request already exists: ${url}`);
}

const pushed = run('git', ['push', '-u', 'origin', branch]);
if (pushed.status !== 0) fail(`git push failed: ${pushed.err || pushed.out}`);

const tmp = mkdtempSync(join(tmpdir(), 'sdd-pr-'));
const bodyFile = join(tmp, 'body.md');
writeFileSync(bodyFile, body, 'utf8');
let created;
try {
  created = run('gh', ['pr', 'create', '--base', base, '--head', branch, '--title', title, '--body-file', bodyFile]);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
if (created.status !== 0) fail(`gh pr create failed: ${created.err || created.out}`);

const url = created.out.split('\n').filter(Boolean).pop() ?? '';
finish({ ok: true, url, created: true }, 0, `Pull request opened: ${url}`);
