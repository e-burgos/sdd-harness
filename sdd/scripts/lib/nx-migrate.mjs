import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

export function parseMajor(range) {
  const match = /(\d+)\.\d+/.exec(String(range ?? '').replace(/^[\^~>=<\s]+/, ''));
  if (match) return Number(match[1]);
  const bare = /^(\d+)$/.exec(String(range ?? '').trim());
  return bare ? Number(bare[1]) : null;
}

export function detectNxMajor(pkg) {
  const range = pkg?.dependencies?.nx ?? pkg?.devDependencies?.nx;
  return range ? parseMajor(range) : null;
}

export function detectPackageManager(root) {
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(root, 'package-lock.json'))) return 'npm';
  return 'pnpm';
}

export function highestVersion(versions) {
  const list = (Array.isArray(versions) ? versions : [versions]).filter((v) => /^\d+\.\d+\.\d+$/.test(v));
  const key = (v) => v.split('.').map(Number);
  return (
    list.sort((a, b) => {
      const [x, y] = [key(a), key(b)];
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
    })[list.length - 1] ?? null
  );
}

export function planHops(current, target) {
  if (!Number.isInteger(current) || !Number.isInteger(target) || target <= current) return [];
  const hops = [];
  for (let major = current + 1; major <= target; major++) hops.push(major);
  return hops;
}

export function installCommand(pm) {
  return { command: pm, args: ['install'] };
}

export function supportsNoAgentic(installedMajor) {
  return Number.isInteger(installedMajor) && installedMajor >= 24;
}

export function runMigrationsCommand({ noAgentic }) {
  const args = ['nx', 'migrate', '--run-migrations'];
  if (noAgentic) args.push('--no-agentic');
  return { step: 'run-migrations', command: 'npx', args };
}

export function hopCommands({ pm, version, hasMigrations, noAgentic = false }) {
  const commands = [
    { step: 'migrate', command: 'npx', args: ['nx', 'migrate', version] },
    { step: 'install', ...installCommand(pm) },
  ];
  if (hasMigrations) commands.push(runMigrationsCommand({ noAgentic }));
  return commands;
}

export function runRefusedOrFailed(result) {
  if (result.ok === false) return 'exit';
  if (/Not starting the run/i.test(result.output ?? '')) return 'refused';
  return null;
}

export function formatCommand({ command, args }) {
  return [command, ...args].join(' ');
}

export function readRootPackage(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

export function gitRunner(root) {
  return (args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    return { status: result.status, stdout: (result.stdout ?? '').trim() };
  };
}

export function prepareMigrationBranch({ git, target }) {
  const current = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (current.status !== 0) return { ok: false, error: 'could not read the current git branch' };
  const remoteHead = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  const remoteDefault = remoteHead.status === 0 ? remoteHead.stdout.replace(/^[^/]+\//, '') : null;
  const defaults = new Set(['main', 'master', ...(remoteDefault ? [remoteDefault] : [])]);
  if (!defaults.has(current.stdout)) return { ok: true, branch: current.stdout, created: false, switched: false };
  const name = `chore/nx-${target}`;
  const exists = git(['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]).status === 0;
  const switched = exists ? git(['switch', name]) : git(['switch', '-c', name]);
  if (switched.status !== 0) return { ok: false, error: `could not switch to branch ${name}` };
  return { ok: true, branch: name, created: !exists, switched: true, from: current.stdout };
}

export function readInstalledNxMajor(root) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'node_modules', 'nx', 'package.json'), 'utf8'));
    return parseMajor(pkg.version);
  } catch {
    return null;
  }
}

export function listPendingPrompts(root) {
  const base = join(root, 'tools', 'ai-migrations');
  const walk = (dir) => {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .sort()
      .flatMap((name) => {
        const full = join(dir, name);
        return statSync(full).isDirectory() ? walk(full) : [full];
      });
  };
  return walk(base).map((file) => file.slice(root.length + 1).split('\\').join('/'));
}

function outcomeOf(result) {
  return typeof result === 'boolean' ? { ok: result, output: '' } : result;
}

export function executeHops({
  root,
  hops,
  pm,
  resolveVersion,
  run,
  fileExists,
  removeFile,
  prepareBranch,
  readInstalledMajor = readInstalledNxMajor,
  listPending = listPendingPrompts,
}) {
  const completed = [];
  let branch = null;
  if (prepareBranch && hops.length > 0) {
    branch = prepareBranch(hops[hops.length - 1]);
    if (!branch.ok) return { ok: false, completed, branch, failed: { major: hops[0], step: 'branch', version: null, reason: branch.error } };
  }
  for (const major of hops) {
    const version = resolveVersion(major);
    if (!version) return { ok: false, completed, branch, failed: { major, step: 'resolve', version: null } };
    for (const step of hopCommands({ pm, version, hasMigrations: false })) {
      if (!outcomeOf(run(step, root)).ok) return { ok: false, completed, branch, failed: { major, step: step.step, version } };
    }
    if (fileExists(join(root, 'migrations.json'))) {
      const installed = readInstalledMajor(root) ?? major;
      const migrations = runMigrationsCommand({ noAgentic: supportsNoAgentic(installed) });
      const outcome = outcomeOf(run(migrations, root));
      const problem = runRefusedOrFailed(outcome);
      if (problem) {
        const reason = problem === 'refused' ? 'nx refused to start the run (default branch); migrations.json was kept' : 'nx migrate --run-migrations exited with an error; migrations.json was kept';
        return { ok: false, completed, branch, failed: { major, step: migrations.step, version, reason } };
      }
      removeFile(join(root, 'migrations.json'));
    }
    completed.push({ major, version });
  }
  return { ok: true, completed, branch, pendingPrompts: listPending(root) };
}
