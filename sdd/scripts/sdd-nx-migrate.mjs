#!/usr/bin/env node
import { existsSync, realpathSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  detectNxMajor,
  detectPackageManager,
  executeHops,
  formatCommand,
  gitRunner,
  highestVersion,
  hopCommands,
  planHops,
  prepareMigrationBranch,
  readRootPackage,
} from './lib/nx-migrate.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SDD = realpathSync(resolve(__dirname, '..'));
const REPO = resolve(SDD, '..');

const args = process.argv.slice(2);
const json = args.includes('--json');
const yes = args.includes('--yes');
const toIndex = args.indexOf('--to');
const toRaw = toIndex >= 0 ? args[toIndex + 1] : args.find((a) => a.startsWith('--to='))?.slice(5);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: pnpm sdd:nx-migrate -- --to <major> [--yes] [--json]

  Migrates the Nx workspace one major at a time (22 -> 23 -> 24, never skipping).
  Without --yes it prints the plan and changes nothing. With --yes, per hop it runs
  npx nx migrate <latest of that major>, the package manager install and, when a migrations.json
  appears, npx nx migrate --run-migrations (--no-agentic from Nx 24), then deletes migrations.json
  only if the run really happened. On the default branch (main/master) it first creates and switches
  to chore/nx-<major>, because Nx 24 refuses to run migrations there. It never commits or pushes
  (Nx 24 itself may commit per migration on that branch). Deferred AI prompts left in
  tools/ai-migrations/ are listed for the project agent to apply.
  --to <major>  → target Nx major
  --yes         → execute the plan (needs a clean git working tree)
  --json        → structured output for agents

Exits 0 when planned, executed or nothing to do, 1 when it cannot run or a step fails, 2 on a usage error.
Verification checklist: sdd/skills/nx-migration/SKILL.md`);
  process.exit(0);
}

function finish(payload, code, message) {
  if (json) console.log(JSON.stringify(payload, null, 2));
  else if (message) (code === 0 ? console.log : console.error)(message);
  process.exit(code);
}

function fail(reason, code = 1, extra = {}) {
  finish({ ok: false, error: reason, ...extra }, code, `[sdd:nx-migrate] ✗ ${reason}`);
}

const target = Number(toRaw);
if (!toRaw || !Number.isInteger(target) || target < 1) fail('--to <major> is required (e.g. --to 24)', 2);

const current = detectNxMajor(readRootPackage(REPO));
if (current === null) fail('nx was not found in the root package.json (dependencies or devDependencies)', 2);

const pm = detectPackageManager(REPO);
const hops = planHops(current, target);

if (hops.length === 0) {
  finish({ ok: true, current, target, pm, hops: [], message: 'nothing to do' }, 0, `[sdd:nx-migrate] Nx ${current} is already at or above ${target}: nothing to do.`);
}

function resolveVersion(major) {
  try {
    const out = execFileSync('npm', ['view', `nx@${major}`, 'version', '--json'], { cwd: REPO, encoding: 'utf8' });
    return highestVersion(JSON.parse(out));
  } catch {
    return null;
  }
}

function planText() {
  const lines = [`[sdd:nx-migrate] Nx ${current} -> ${target} (${pm}), ${hops.length} hop(s):`];
  for (const major of hops) {
    const placeholder = `<latest ${major}.x>`;
    lines.push(`  Nx ${major}:`);
    for (const step of hopCommands({ pm, version: placeholder, hasMigrations: true })) lines.push(`    ${formatCommand(step)}`);
    lines.push('    rm migrations.json (only after a successful run)');
  }
  lines.push('On main/master a branch chore/nx-<major> is created first; Nx 24 may commit per migration on it. Nothing is pushed.');
  lines.push('Run again with --yes to execute (clean git tree required).');
  return lines.join('\n');
}

if (!yes) {
  finish({ ok: true, executed: false, current, target, pm, hops: hops.map((major) => ({ major, steps: hopCommands({ pm, version: `<latest ${major}.x>`, hasMigrations: true }).map(formatCommand) })) }, 0, planText());
}

const status = spawnSync('git', ['status', '--porcelain'], { cwd: REPO, encoding: 'utf8' });
if (status.status !== 0) fail('this is not a git repository, or git failed', 1);
if (status.stdout.trim() !== '') fail('the git working tree is dirty: commit or stash first, then work on a branch', 1);

function run(step, cwd) {
  if (!json) console.log(`[sdd:nx-migrate] $ ${formatCommand(step)}`);
  const result = spawnSync(step.command, step.args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (!json) process.stdout.write(output);
  return { ok: result.status === 0, output };
}

const result = executeHops({
  root: REPO,
  hops,
  pm,
  resolveVersion,
  run,
  fileExists: existsSync,
  removeFile: (path) => rmSync(path, { force: true }),
  prepareBranch: (targetMajor) => {
    const outcome = prepareMigrationBranch({ git: gitRunner(REPO), target: targetMajor });
    if (outcome.ok && outcome.switched && !json) console.log(`[sdd:nx-migrate] on ${outcome.from}: ${outcome.created ? 'created' : 'switched to'} branch ${outcome.branch}`);
    return outcome;
  },
});

if (!result.ok) {
  const { major, step, version } = result.failed;
  fail(
    `Nx ${major}: step "${step}" failed${version ? ` (${version})` : ''}${result.failed.reason ? ` - ${result.failed.reason}` : ''}. Fix it, commit the partial state on the branch, then resume with: pnpm sdd:nx-migrate -- --to ${target} --yes`,
    1,
    { current, target, branch: result.branch?.branch ?? null, completed: result.completed, failed: result.failed },
  );
}

const pending = result.pendingPrompts;
const pendingText = pending.length
  ? `\n[sdd:nx-migrate] Pending for the project agent: apply these prompts in order, then delete tools/ai-migrations/\n${pending.map((file) => `  - ${file}`).join('\n')}`
  : '';

finish(
  { ok: true, executed: true, current, target, pm, branch: result.branch?.branch ?? null, completed: result.completed, pendingPrompts: pending },
  0,
  `[sdd:nx-migrate] ✓ Nx ${current} -> ${target} done (${result.completed.map((h) => h.version).join(', ')})${result.branch?.branch ? ` on branch ${result.branch.branch}` : ''}. Nothing was pushed; Nx may have committed per migration on that branch. Verify with the checklist in sdd/skills/nx-migration/SKILL.md.${pendingText}`,
);
