#!/usr/bin/env node
// Task registry as a command: pnpm sdd:task <spec-id|slug> cycle-XX TASK-NNN start|done [options]
// Writes status, files and usage into the cycle tasks.json, rebuilds the index and validates.
// Exits 0 ok, 1 validation red after the write, 2 usage / unknown unit (file untouched).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyDone,
  applyStart,
  buildUsage,
  filesFromShow,
  mergeFiles,
  normalizeCycleRef,
  parseTasksText,
  parseTaskRequest,
  resolveSpecRef,
  serializeTasks,
  summaryLine,
} from './lib/task-registry.mjs';

const SCRIPTS = fileURLToPath(new URL('.', import.meta.url));
const SDD = resolve(SCRIPTS, '..');
const REPO = resolve(SDD, '..');

const USAGE = `Usage: pnpm sdd:task <spec-id|slug> cycle-XX TASK-NNN start
       pnpm sdd:task <spec-id|slug> cycle-XX TASK-NNN done (--files a,b | --commit <sha>[,<sha>]) \\
         (--tokens <total> | --tokens-in N --tokens-out M) --model <provider/model> --effort <level> --agent <role> \\
         [--source <usageSource>] [--approx] [--duration <minutes>] [--batch B-NN --batch-tokens N] \\
         [--pack-miss <path> ...] [--force]

Exits 0 ok, 1 validation red after the write, 2 usage or unknown task/cycle (file untouched).`;

function usageError(message) {
  process.stderr.write(`[sdd-task] ✗ ${message}\n`);
  process.exit(2);
}

function git(args) {
  const run = spawnSync('git', ['-C', REPO, ...args], { encoding: 'utf8' });
  return run.status === 0 ? run.stdout : null;
}

function sddPrefix() {
  const top = git(['rev-parse', '--show-toplevel']);
  if (top === null) return 'sdd/';
  const rel = relative(top.trim(), SDD).split('\\').join('/');
  return rel ? `${rel}/` : '';
}

function filesOfCommits(commits) {
  const prefix = sddPrefix();
  return commits.flatMap((sha) => {
    if (git(['rev-parse', '--verify', '--quiet', `${sha}^{commit}`]) === null) usageError(`commit "${sha}" does not exist in this repository`);
    return filesFromShow(git(['show', '--name-only', '--format=', '--first-parent', '-m', sha]) ?? '', prefix);
  });
}

function tasksFileOf(request) {
  let index;
  try {
    index = JSON.parse(readFileSync(join(SDD, 'specs', 'index.json'), 'utf8'));
  } catch {
    usageError('sdd/specs/index.json is missing or invalid');
  }
  const resolved = resolveSpecRef(index.specs ?? [], request.spec);
  if (resolved.error) usageError(resolved.error);
  const cycle = normalizeCycleRef(request.cycle);
  if (!cycle) usageError(`invalid cycle "${request.cycle}" — use cycle-XX`);
  const file = join(REPO, resolved.spec.folder, 'cycles', cycle, 'tasks.json');
  if (!existsSync(file)) usageError(`${cycle} of ${resolved.spec.id} has no tasks.json`);
  return file;
}

function runKitScript(name, args = []) {
  const run = spawnSync(process.execPath, [join(SCRIPTS, name), ...args], { encoding: 'utf8', cwd: REPO });
  return { status: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}`.trim() };
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    return;
  }
  const parsed = parseTaskRequest(argv);
  if (!parsed.ok) usageError(`${parsed.message}\n${USAGE}`);
  const { request } = parsed;
  const file = tasksFileOf(request);
  let doc;
  try {
    doc = parseTasksText(readFileSync(file, 'utf8'));
  } catch (error) {
    usageError(`${file} is not valid JSON: ${error.message}`);
  }
  const outcome =
    request.action === 'start'
      ? applyStart(doc, request.task, { force: request.force })
      : applyDone(doc, request.task, {
          files: mergeFiles(request.files, filesOfCommits(request.commits)),
          usage: buildUsage(request),
          force: request.force,
        });
  if (!outcome.ok) usageError(outcome.message);
  writeFileSync(file, serializeTasks(doc), 'utf8');
  const rebuilt = runKitScript('rebuild-tasks-index.mjs');
  if (rebuilt.status !== 0) {
    process.stderr.write(`${rebuilt.output}\n`);
    process.exit(1);
  }
  const validation = runKitScript('validate-sdd.mjs');
  if (validation.status !== 0) {
    process.stderr.write(`${validation.output}\n`);
    process.exit(1);
  }
  console.log(`${summaryLine(request, outcome.task)} · validate OK`);
}

main();
