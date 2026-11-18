import { closeSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { hostname, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { isPidAlive } from './verify-lease.mjs';

export const ACTIONS = ['start', 'done'];
export const TASK_ID_RE = /^TASK(-[A-Z]+)?(-\d+)+$/;
export const MODEL_RE = /^(haiku|sonnet|opus|fable|(claude|gemini|copilot)\/[a-z0-9][a-z0-9.-]*)$/;
export const EFFORT_RE = /^[a-z][a-z0-9-]*$/;
export const BATCH_RE = /^B-\d{2}$/;
export const AGENTS = [
  'functional',
  'planner',
  'architect',
  'implementor-back',
  'implementor-front',
  'reviewer',
  'orchestrator',
  'steward',
  'hermes',
  'custom',
];
export const SOURCES = ['session-report', 'stats-command', 'api-usage', 'agent-usage-notification', 'declared-estimate'];
export const MAX_PACK_MISSES = 5;
export const INPUT_SHARE = 0.85;

const VALUE_FLAGS = new Set([
  'files',
  'commit',
  'tokens',
  'tokens-in',
  'tokens-out',
  'model',
  'effort',
  'agent',
  'source',
  'duration',
  'batch',
  'batch-tokens',
  'pack-miss',
]);
const BOOLEAN_FLAGS = new Set(['approx', 'force']);

const reject = (message) => ({ ok: false, message });

function tokenize(argv) {
  const flags = {};
  const positional = [];
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const [name, inline] = token.slice(2).split(/=(.*)/s);
    if (BOOLEAN_FLAGS.has(name)) flags[name] = true;
    else if (VALUE_FLAGS.has(name)) {
      const value = inline ?? argv[++index];
      if (value === undefined) return reject(`--${name} needs a value`);
      if (name === 'pack-miss') flags[name] = [...(flags[name] ?? []), ...value.split(',').map((item) => item.trim()).filter(Boolean)];
      else flags[name] = value;
    } else return reject(`unknown option --${name}`);
  }
  return { ok: true, flags, positional };
}

function toCount(name, raw) {
  if (!/^\d+$/.test(String(raw))) return { error: `--${name} must be a non-negative integer` };
  return { value: Number(raw) };
}

function toMinutes(raw) {
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? { value } : { error: '--duration must be a non-negative number of minutes' };
}

export const splitList = (raw) =>
  String(raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

function parseCounts(flags) {
  const counts = {};
  for (const [flag, key] of [['tokens', 'tokens'], ['tokens-in', 'tokensIn'], ['tokens-out', 'tokensOut'], ['batch-tokens', 'batchTokens']]) {
    if (flags[flag] === undefined) continue;
    const parsed = toCount(flag, flags[flag]);
    if (parsed.error) return reject(parsed.error);
    counts[key] = parsed.value;
  }
  return { ok: true, counts };
}

function validateTokens(flags, counts) {
  const hasSplit = counts.tokensIn !== undefined || counts.tokensOut !== undefined;
  if (counts.tokens !== undefined && hasSplit) return 'use --tokens <total> or --tokens-in/--tokens-out, not both';
  if (counts.tokens === undefined && !hasSplit) return 'done needs --tokens <total> or --tokens-in N --tokens-out M';
  if (hasSplit && (counts.tokensIn === undefined || counts.tokensOut === undefined)) return '--tokens-in and --tokens-out go together';
  return null;
}

function validateIdentity(flags) {
  if (!flags.model) return '--model is required (provider/model, e.g. claude/sonnet)';
  if (!MODEL_RE.test(flags.model)) return `--model "${flags.model}" must match ${MODEL_RE.source}`;
  if (!flags.effort) return '--effort is required (e.g. low|medium|high|xhigh|max)';
  if (!EFFORT_RE.test(flags.effort)) return `--effort "${flags.effort}" must match ${EFFORT_RE.source} (e.g. low|medium|high|xhigh|max)`;
  if (!flags.agent) return `--agent is required (${AGENTS.join('|')})`;
  if (!AGENTS.includes(flags.agent)) return `--agent "${flags.agent}" must be one of: ${AGENTS.join('|')}`;
  return null;
}

function validateTelemetry(flags, counts) {
  const approx = Boolean(flags.approx);
  const source = flags.source ?? (approx ? 'declared-estimate' : 'agent-usage-notification');
  if (!SOURCES.includes(source)) return `--source "${source}" must be one of: ${SOURCES.join('|')}`;
  if (!approx && source === 'declared-estimate') return '--source declared-estimate requires --approx';
  if (flags.batch !== undefined && !BATCH_RE.test(flags.batch)) return `--batch "${flags.batch}" must look like B-01`;
  if ((flags.batch === undefined) !== (counts.batchTokens === undefined)) return '--batch and --batch-tokens go together';
  if (counts.batchTokens !== undefined && !approx) return '--batch-tokens requires --approx';
  if ((flags['pack-miss'] ?? []).length > MAX_PACK_MISSES) return `at most ${MAX_PACK_MISSES} --pack-miss`;
  return null;
}

function parseDone(flags, counts) {
  const problem =
    (!flags.files && !flags.commit && 'done needs --files a,b and/or --commit <sha>[,<sha>]') ||
    validateTokens(flags, counts) ||
    validateIdentity(flags) ||
    validateTelemetry(flags, counts);
  if (problem) return reject(problem);
  let duration;
  if (flags.duration !== undefined) {
    const parsed = toMinutes(flags.duration);
    if (parsed.error) return reject(parsed.error);
    duration = parsed.value;
  }
  return {
    ok: true,
    done: {
      files: splitList(flags.files),
      commits: splitList(flags.commit),
      tokens: counts.tokens,
      tokensIn: counts.tokensIn,
      tokensOut: counts.tokensOut,
      model: flags.model,
      effort: flags.effort,
      agent: flags.agent,
      approx: Boolean(flags.approx),
      source: flags.source ?? (flags.approx ? 'declared-estimate' : 'agent-usage-notification'),
      duration,
      batch: flags.batch,
      batchTokens: counts.batchTokens,
      packMisses: flags['pack-miss'] ?? [],
    },
  };
}

export function parseTaskRequest(argv) {
  const tokenized = tokenize(argv);
  if (!tokenized.ok) return tokenized;
  const { flags, positional } = tokenized;
  const [spec, cycle, task, action] = positional;
  if (positional.length !== 4) return reject('usage: pnpm sdd:task <spec-id|slug> cycle-XX TASK-NNN start|done [options]');
  if (!ACTIONS.includes(action)) return reject(`action must be start or done, got "${action}"`);
  if (!TASK_ID_RE.test(task)) return reject(`invalid task id "${task}" — use TASK-NNN`);
  const request = { spec, cycle, task, action, force: Boolean(flags.force) };
  if (action === 'start') return { ok: true, request };
  const counted = parseCounts(flags);
  if (!counted.ok) return counted;
  const done = parseDone(flags, counted.counts);
  return done.ok ? { ok: true, request: { ...request, ...done.done } } : done;
}

export function splitTokens(total) {
  const tokensIn = Math.round(total * INPUT_SHARE);
  return { tokens_in: tokensIn, tokens_out: total - tokensIn };
}

export function localDate(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildUsage(request, now = new Date()) {
  const counts =
    request.tokens !== undefined
      ? { ...splitTokens(request.tokens), tokens_total: request.tokens }
      : { tokens_in: request.tokensIn, tokens_out: request.tokensOut };
  const usage = {
    provider_model: request.model,
    effort: request.effort,
    agent: request.agent,
    ...counts,
    ...(request.duration !== undefined ? { duration_minutes: request.duration } : {}),
    approx: request.approx,
    source: request.source,
    recorded_at: localDate(now),
  };
  if (request.batch !== undefined) usage.allocation = { batch: request.batch, batch_tokens: request.batchTokens };
  if (request.packMisses.length > 0) usage.pack_misses = [...request.packMisses];
  return usage;
}

export function mergeFiles(...lists) {
  return [...new Set(lists.flat())];
}

export function filesFromShow(output, sddPrefix = 'sdd/') {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.replace(/\\/g, '/').startsWith(sddPrefix));
}

export function parseTasksText(text) {
  return JSON.parse(text.replace(/^﻿/, ''));
}

export const DEFAULT_FORMAT = { indent: 2, eol: '\n', finalNewline: true };

export function detectFormat(text) {
  const body = text.replace(/^\uFEFF/, '');
  const indented = /^([ \t]+)\S/m.exec(body);
  let indent = DEFAULT_FORMAT.indent;
  if (indented) {
    if (indented[1].startsWith('\t')) indent = '\t';
    else if (indented[1].length === 4) indent = 4;
  }
  return { indent, eol: body.includes('\r\n') ? '\r\n' : '\n', finalNewline: /\n$/.test(body) };
}

export function serializeTasks(doc, format = DEFAULT_FORMAT) {
  const text = `${JSON.stringify(doc, null, format.indent)}${format.finalNewline === false ? '' : '\n'}`;
  return format.eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
}

export const findTask = (doc, id) => (doc.tasks ?? []).find((task) => task.id === id);

function withUsageAfterFiles(task, files, usage) {
  const rebuilt = {};
  for (const [key, value] of Object.entries(task)) {
    if (key === 'usage') continue;
    rebuilt[key] = key === 'files' ? files : value;
    if (key === 'files') rebuilt.usage = usage;
  }
  return rebuilt;
}

export function applyStart(doc, id, { force = false } = {}) {
  const task = findTask(doc, id);
  if (!task) return { ok: false, message: `${id} is not in this cycle's tasks.json` };
  if (task.status === 'done' && !force) return { ok: false, message: `${id} is already done — use --force to reopen it` };
  task.status = 'in-progress';
  return { ok: true, task };
}

export function applyDone(doc, id, { files, usage, force = false }) {
  const index = (doc.tasks ?? []).findIndex((task) => task.id === id);
  if (index < 0) return { ok: false, message: `${id} is not in this cycle's tasks.json` };
  const current = doc.tasks[index];
  if (current.status === 'done' && !force) return { ok: false, message: `${id} is already done — use --force to replace its files and usage` };
  const updated = withUsageAfterFiles({ ...current, status: 'done' }, files, usage);
  if (!('files' in updated)) {
    updated.files = files;
    updated.usage = usage;
  }
  doc.tasks[index] = updated;
  return { ok: true, task: updated };
}

export function summaryLine(request, task) {
  if (request.action === 'start') return `${request.task} start`;
  const usage = task.usage;
  const total = usage.tokens_total ?? usage.tokens_in + usage.tokens_out;
  return `${request.task} done · ${task.files.length} files · ${total.toLocaleString('en-US')} tokens`;
}

export function resolveSpecRef(specs, query) {
  const exact = specs.find((spec) => spec.id === query);
  if (exact) return { spec: exact };
  const matches = specs.filter((spec) => spec.id.endsWith(`-${query}`) || spec.id.includes(query));
  if (matches.length === 1) return { spec: matches[0] };
  if (matches.length > 1) return { error: `"${query}" is ambiguous: ${matches.map((spec) => spec.id).join(', ')}` };
  return { error: `spec "${query}" is not in sdd/specs/index.json (${specs.length} registered)` };
}

export function normalizeCycleRef(raw) {
  const match = /^(?:cycle-)?(\d{1,2})$/.exec(String(raw ?? ''));
  return match ? `cycle-${match[1].padStart(2, '0')}` : null;
}

export const lockFileFor = (tasksFile) =>
  join(tmpdir(), 'sdd-harness', 'task-locks', `${createHash('sha1').update(tasksFile).digest('hex').slice(0, 16)}.lock`);

export const LOCK_POLL_MS = 100;
export const LOCK_TIMEOUT_MS = 30000;
export const LOCK_STALE_MS = 60000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readLockOwner(file) {
  try {
    const owner = JSON.parse(readFileSync(file, 'utf8'));
    return owner && typeof owner === 'object' ? owner : null;
  } catch {
    return null;
  }
}

function lockSignature(file) {
  try {
    return `${statSync(file).mtimeMs}:${JSON.stringify(readLockOwner(file))}`;
  } catch {
    return null;
  }
}

function lockIsStale(file, staleMs) {
  let age;
  try {
    age = Date.now() - statSync(file).mtimeMs;
  } catch {
    return false;
  }
  if (age > staleMs) return true;
  const owner = readLockOwner(file);
  return Boolean(owner && owner.host === hostname() && !isPidAlive(owner.pid));
}

function createLock(file) {
  let fd;
  try {
    fd = openSync(file, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
  try {
    writeSync(fd, `${JSON.stringify({ pid: process.pid, host: hostname() })}\n`);
  } finally {
    closeSync(fd);
  }
  return true;
}

function removeOwnLock(file) {
  const owner = readLockOwner(file);
  if (!owner || owner.pid !== process.pid || owner.host !== hostname()) return;
  try {
    unlinkSync(file);
  } catch {
    return;
  }
}

function takeStaleLock(file, staleMs) {
  if (!lockIsStale(file, staleMs)) return;
  const judged = lockSignature(file);
  if (judged === null || lockSignature(file) !== judged) return;
  try {
    unlinkSync(file);
  } catch {
    return;
  }
}

export async function withFileLock(file, work, { pollMs = LOCK_POLL_MS, timeoutMs = LOCK_TIMEOUT_MS, staleMs = LOCK_STALE_MS } = {}) {
  mkdirSync(dirname(file), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  while (!createLock(file)) {
    if (Date.now() >= deadline) {
      throw new Error(`could not take the lock ${file} within ${Math.round(timeoutMs / 1000)}s — another sdd:task is running or left it behind; remove it if no sdd:task is running`);
    }
    takeStaleLock(file, staleMs);
    await sleep(pollMs);
  }
  const release = () => removeOwnLock(file);
  const onSignal = (code) => () => {
    release();
    process.exit(code);
  };
  const onInt = onSignal(130);
  const onTerm = onSignal(143);
  process.on('exit', release);
  process.on('SIGINT', onInt);
  process.on('SIGTERM', onTerm);
  try {
    return await work();
  } finally {
    release();
    process.off('exit', release);
    process.off('SIGINT', onInt);
    process.off('SIGTERM', onTerm);
  }
}
