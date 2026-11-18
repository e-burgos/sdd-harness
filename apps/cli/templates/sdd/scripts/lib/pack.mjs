// Pure logic of sdd:pack: markdown heading model, section resolution, selectors and pack assembly.
// Every input arrives through `io` (read/list), so the same code serves the CLI, the validator and tests.
import { createHash } from 'node:crypto';
import { formatDuration, resolveEntryId } from './verify.mjs';

export const SDD_DIR = 'sdd';
export const CYCLE_DOCS = { architect: 'architect.md', functional: 'functional.md', planner: 'planner.md', plan: 'plan.md' };
export const DEFAULT_LIMITS = { context_inline_max_bytes: 12000, max_pack_bytes: 60000 };
export const DEFAULT_CONTEXT_ALWAYS = ['regla', 'gotcha', 'restric', 'stack', 'comando', 'rule', 'constraint', 'command'];
export const BATCH_ID_RE = /^B-\d{2}$/;
export const TASK_ID_RE = /^TASK(-[A-Z]+)?(-\d+)+$/;
export const ROLE_NAME_RE = /^[a-z][a-z0-9-]*$/;

const REGISTRY_FILES = { api: 'api.json', schema: 'schema.json', components: 'components.json' };
const ENTRY_LISTS = ['endpoints', 'components', 'tables', 'models', 'entities'];
const INDEX_HINT = 'leé solo lo que necesites con offset/limit';
const HEADING_ID_RE = /^([A-Z]+(?:-\d+)+)(?![A-Za-z0-9-])/;
const MENTION_RE = /(?<![A-Za-z0-9-])([A-Z]+(?:-\d+)+)(?![A-Za-z0-9-])/g;
const RANGE_RE = /(?<![A-Za-z0-9-])([A-Z]+(?:-\d+)*-)(\d+)(?:\.{2,3}|…)(?:\1)?(\d+)(?![A-Za-z0-9-])/g;
const RANGE_CAP = 200;
const APP_ID_RE = /^(apps|libs|tools)\/(?!\.\.?$)[A-Za-z0-9._-]+$/;
const LEADING_MARKUP_RE = /^[*_`\[(\s]+/;
const CRITERION_RE = /^\s*- \[[ xX]\] CA-/;

export function normalizeText(raw) {
  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw ?? '');
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

export function splitLines(text) {
  const lines = normalizeText(text).split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function normalizeHeading(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

export function maskedLines(lines) {
  const masked = new Set();
  let index = 0;
  if (lines[0] !== undefined && lines[0].trim() === '---') {
    const close = lines.findIndex((line, at) => at > 0 && (line.trim() === '---' || line.trim() === '...'));
    if (close > 0) {
      for (let at = 0; at <= close; at++) masked.add(at);
      index = close + 1;
    }
  }
  let fence = null;
  let comment = false;
  for (; index < lines.length; index++) {
    const line = lines[index];
    if (comment) {
      masked.add(index);
      if (line.includes('-->')) comment = false;
      continue;
    }
    const marker = FENCE_RE.exec(line);
    if (fence) {
      masked.add(index);
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && marker[2].trim() === '') fence = null;
      continue;
    }
    if (marker) {
      masked.add(index);
      fence = { char: marker[1][0], length: marker[1].length };
      continue;
    }
    const open = line.indexOf('<!--');
    if (open >= 0 && !line.includes('-->', open + 4)) {
      comment = true;
      if (open === 0) masked.add(index);
    }
  }
  return masked;
}

export function parseHeadings(lines) {
  const masked = maskedLines(lines);
  const found = [];
  lines.forEach((line, index) => {
    if (masked.has(index)) return;
    const match = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*$/.exec(line);
    if (!match) return;
    const text = match[2].replace(/[ \t]+#+$/, '').trim();
    if (!text) return;
    found.push({ level: match[1].length, text, line: index + 1 });
  });
  return found.map((heading, position) => {
    const next = found.slice(position + 1).find((candidate) => candidate.level <= heading.level);
    let end = next ? next.line - 1 : lines.length;
    while (end > heading.line && lines[end - 1].trim() === '') end--;
    return { ...heading, end };
  });
}

export function headingId(text) {
  const match = HEADING_ID_RE.exec(stripLeadingMarkup(text));
  return match ? match[1] : null;
}

const stripLeadingMarkup = (text) => String(text ?? '').replace(LEADING_MARKUP_RE, '');

function startsWithToken(rawText, token) {
  const text = stripLeadingMarkup(rawText);
  if (!token || !text.startsWith(token)) return false;
  const next = text[token.length];
  return next === undefined || !/[\p{L}\p{N}-]/u.test(next);
}

export function resolveToken(headings, rawToken) {
  const token = String(rawToken ?? '').trim();
  if (!token) return { reason: 'empty token' };
  const byPrefix = headings.find((heading) => startsWithToken(heading.text, token));
  if (byPrefix) return { heading: byPrefix };
  const wanted = normalizeHeading(token);
  if (!wanted) return { reason: 'empty token' };
  const equal = headings.find((heading) => normalizeHeading(heading.text) === wanted);
  if (equal) return { heading: equal };
  const containing = headings.filter((heading) => ` ${normalizeHeading(heading.text)} `.includes(` ${wanted} `));
  if (containing.length === 1) return { heading: containing[0] };
  return { reason: containing.length > 1 ? 'ambiguous' : 'not found' };
}

export function resolveTaskHeading(headings, taskId) {
  return headings.find((heading) => startsWithToken(heading.text, taskId)) ?? null;
}

export function parentIds(id) {
  const out = [];
  let current = String(id ?? '');
  for (;;) {
    const match = /^([A-Z]+(?:-\d+)+)-\d+$/.exec(current);
    if (!match) return out;
    current = match[1];
    out.push(current);
  }
}

export function resolveWithParents(headings, token) {
  const direct = resolveToken(headings, token);
  if (direct.heading) return direct;
  for (const parent of parentIds(String(token ?? '').trim())) {
    const found = headings.find((heading) => startsWithToken(heading.text, parent));
    if (found) return { heading: found };
  }
  return direct;
}

function eachRange(text, visit) {
  for (const match of String(text ?? '').matchAll(RANGE_RE)) {
    const [raw, prefix, from, to] = match;
    visit({ raw, prefix, from, to, start: Number(from), stop: Number(to), width: Math.max(from.length, to.length) });
  }
}

export function expandRanges(text) {
  const ids = [];
  eachRange(text, ({ prefix, start, stop, width }) => {
    if (stop < start || stop - start > RANGE_CAP) return;
    for (let n = start; n <= stop; n++) ids.push(`${prefix}${String(n).padStart(width, '0')}`);
  });
  return ids;
}

export function rangeProblems(text) {
  const problems = [];
  eachRange(text, ({ raw, start, stop }) => {
    if (stop < start) problems.push(`${raw} (rango invertido)`);
    else if (stop - start > RANGE_CAP) problems.push(`${raw} (rango de más de ${RANGE_CAP})`);
  });
  return problems;
}

export function mentionedIds(text, knownIds) {
  const wanted = new Set();
  const note = (id) => {
    if (knownIds.has(id)) {
      wanted.add(id);
      return;
    }
    const parent = parentIds(id).find((candidate) => knownIds.has(candidate));
    if (parent) wanted.add(parent);
  };
  for (const match of String(text ?? '').matchAll(MENTION_RE)) note(match[1]);
  eachRange(text, ({ prefix, start, stop, width }) => {
    if (stop < start || stop - start > RANGE_CAP) return;
    for (let n = start; n <= stop; n++) {
      const padded = `${prefix}${String(n).padStart(width, '0')}`;
      note(knownIds.has(padded) ? padded : `${prefix}${n}`);
    }
  });
  return wanted;
}

export function parseExplicitRef(ref) {
  const match = /^([a-z][a-z0-9-]*)#(.+)$/.exec(String(ref ?? ''));
  return match ? { doc: match[1], token: match[2].trim() } : null;
}

export function parseSelector(raw) {
  const text = String(raw ?? '').trim();
  if (text.startsWith('section:')) {
    const rest = text.slice('section:'.length);
    const at = rest.indexOf('#');
    if (at < 1 || at === rest.length - 1) return { kind: 'invalid', raw: text };
    return { kind: 'section', path: rest.slice(0, at).trim(), token: rest.slice(at + 1).trim(), raw: text };
  }
  if (text === 'cycle' || text === 'spec' || text === 'acceptance' || text === 'verify-results') return { kind: text, raw: text };
  let match = /^tasks:@(unit|all:summary)$/.exec(text);
  if (match) return { kind: match[1] === 'unit' ? 'tasks-unit' : 'tasks-summary', raw: text };
  if (text === 'plan:@unit') return { kind: 'plan-unit', raw: text };
  if (text === 'refs:@unit') return { kind: 'refs-unit', raw: text };
  match = /^(index|doc):(architect|functional|planner|plan)$/.exec(text);
  if (match) return { kind: match[1], doc: match[2], raw: text };
  match = /^context:@app(:index)?$/.exec(text);
  if (match) return { kind: 'context', index: Boolean(match[1]), raw: text };
  if (text === 'registry:api@unit') return { kind: 'registry-unit', registry: 'api', raw: text };
  match = /^registry:(api|schema|components)@app(:index)?$/.exec(text);
  if (match) return { kind: 'registry', registry: match[1], index: Boolean(match[2]), raw: text };
  if (text === 'verify:@app') return { kind: 'verify', raw: text };
  return { kind: 'invalid', raw: text };
}

export const selectorNeedsApp = (selector) =>
  selector.kind === 'context' || selector.kind === 'registry' || selector.kind === 'verify';

export const packNeedsApp = (include) => (include ?? []).some((raw) => selectorNeedsApp(parseSelector(raw)));

export function parseUnitArg(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { error: 'empty unit' };
  if (BATCH_ID_RE.test(text)) return { kind: 'batch', id: text };
  const ids = text.split(',').map((item) => item.trim()).filter(Boolean);
  if (ids.length && ids.every((id) => TASK_ID_RE.test(id))) return { kind: 'tasks', ids: [...new Set(ids)] };
  return { error: `invalid unit "${text}" — use B-NN or TASK-NNN[,TASK-NNN…]` };
}

const isEntry = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const taskEntries = (tasksJson) =>
  (Array.isArray(tasksJson?.tasks) ? tasksJson.tasks : []).filter((task) => isEntry(task) && typeof task.id === 'string');
const batchEntries = (tasksJson) =>
  (Array.isArray(tasksJson?.batches) ? tasksJson.batches : []).filter((batch) => isEntry(batch) && typeof batch.id === 'string');
const idList = (value) => (Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []);

export const isSafeApp = (app) => typeof app === 'string' && APP_ID_RE.test(app);

export function resolveUnit(tasksJson, request) {
  const tasks = taskEntries(tasksJson);
  const order = new Map(tasks.map((task, index) => [task.id, index]));
  if (request.kind === 'batch') {
    const batch = batchEntries(tasksJson).find((item) => item.id === request.id);
    if (!batch) return { error: `unknown block ${request.id} in tasks.json` };
    const missing = idList(batch.tasks).filter((id) => !order.has(id));
    if (missing.length) return { error: `block ${request.id} lists unknown task ${missing.join(', ')}` };
    const taskIds = [...new Set(idList(batch.tasks))].sort((a, b) => order.get(a) - order.get(b));
    return { unit: { id: request.id, kind: 'batch', taskIds, app: typeof batch.app === 'string' ? batch.app : null } };
  }
  const missing = request.ids.filter((id) => !order.has(id));
  if (missing.length) return { error: `unknown task ${missing.join(', ')} in tasks.json` };
  const taskIds = [...request.ids].sort((a, b) => order.get(a) - order.get(b));
  return { unit: { id: taskIds.join('+'), kind: 'tasks', taskIds, app: null } };
}

export function resolveApp({ requested, unitApp, cycleApps }) {
  const apps = (Array.isArray(cycleApps) ? cycleApps : []).filter((app) => typeof app === 'string');
  if (requested !== undefined && requested !== null) {
    if (!isSafeApp(requested)) return { error: `--app "${requested}" must be a relative apps|libs|tools/<name> path without ".."` };
    if (apps.length && !apps.includes(requested)) return { error: `--app ${requested} is not in the cycle's apps: ${apps.join(', ')}` };
    return { app: requested };
  }
  if (unitApp) {
    if (!isSafeApp(unitApp)) return { error: `block app "${unitApp}" must be a relative apps|libs|tools/<name> path without ".."` };
    return { app: unitApp };
  }
  if (apps.length === 1) return isSafeApp(apps[0]) ? { app: apps[0] } : { error: `cycle app "${apps[0]}" is not a valid apps|libs|tools/<name> path` };
  return { app: null, candidates: apps };
}

const sha8 = (buffer) => createHash('sha256').update(buffer).digest('hex').slice(0, 8);
const noSource = (reason) => `(sin fuente: ${reason})`;
const fenceJson = (value) => `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
const headingLine = (heading) => `${'#'.repeat(heading.level)} ${heading.text}`;
const srcLine = (path, from, to) => `<!-- src: ${path}#L${from}-L${to} -->`;
const bareName = (id) => id.slice(id.indexOf('/') + 1);

export function indexLines(doc) {
  return doc.headings.map((heading) => `- L${heading.line}-L${heading.end} · ${headingLine(heading)}`);
}

function sectionText(doc, heading) {
  return doc.lines.slice(heading.line - 1, heading.end).join('\n');
}

function emitSection(doc, heading) {
  return `${srcLine(doc.path, heading.line, heading.end)}\n${sectionText(doc, heading)}`;
}

function emitWholeDoc(doc) {
  return `${srcLine(doc.path, 1, Math.max(doc.lines.length, 1))}\n${doc.lines.join('\n')}`;
}

function dedupeNested(headings) {
  const sorted = [...headings].sort((a, b) => a.line - b.line || b.end - a.end);
  const kept = [];
  for (const heading of sorted) {
    if (kept.some((outer) => outer !== heading && outer.line <= heading.line && heading.end <= outer.end)) continue;
    kept.push(heading);
  }
  return kept;
}

export function createContext({ io, specId, specFolder, cycleId, cycleDir, unit, app, limits, contextAlways, now }) {
  const docs = new Map();
  const used = [];
  const memo = new Map();
  const unresolved = [];
  const trailers = [];
  const ctx = {
    io,
    specId,
    specFolder,
    cycleId,
    cycleDir,
    unit,
    app: isSafeApp(app) ? app : null,
    now,
    limits: { ...DEFAULT_LIMITS, ...(limits ?? {}) },
    contextAlways: Array.isArray(contextAlways) && contextAlways.length ? contextAlways : DEFAULT_CONTEXT_ALWAYS,
    used,
    unresolved,
    trailers,
  };
  ctx.load = (path) => {
    if (docs.has(path)) return docs.get(path);
    const buffer = io.read(path);
    let doc = null;
    if (buffer !== null && buffer !== undefined) {
      const lines = splitLines(buffer);
      doc = { path, bytes: buffer.length, sha: sha8(buffer), lines, headings: parseHeadings(lines), raw: buffer };
    }
    docs.set(path, doc);
    return doc;
  };
  ctx.touch = (doc) => {
    if (doc && !used.includes(doc)) used.push(doc);
    return doc;
  };
  ctx.json = (path) => {
    const doc = ctx.load(path);
    if (!doc) return null;
    try {
      return { doc, value: JSON.parse(normalizeText(doc.raw)) };
    } catch {
      return null;
    }
  };
  ctx.cyclePath = (name) => `${cycleDir}/${name}`;
  ctx.tasksJson = () => ctx.json(ctx.cyclePath('tasks.json'));
  ctx.cycleJson = () => ctx.json(ctx.cyclePath('cycle.json'));
  ctx.unitTasks = () => {
    const entries = taskEntries(ctx.tasksJson()?.value);
    return ctx.unit.taskIds.map((id) => entries.find((task) => task.id === id)).filter(Boolean);
  };
  ctx.get = (rawSelector) => {
    if (!memo.has(rawSelector)) memo.set(rawSelector, runSelector(ctx, parseSelector(rawSelector)));
    return memo.get(rawSelector);
  };
  return ctx;
}

function planSource(ctx) {
  const cycle = ctx.cycleJson()?.value;
  const lite = cycle?.flow === 'lite';
  const planPath = ctx.cyclePath(CYCLE_DOCS.plan);
  const plannerPath = ctx.cyclePath(CYCLE_DOCS.planner);
  const preferred = lite ? planPath : plannerPath;
  const fallback = lite ? plannerPath : planPath;
  const doc = ctx.load(preferred) ?? (lite ? null : ctx.load(fallback));
  return { doc, lite: doc?.path === planPath };
}

function planPieces(ctx) {
  const { doc, lite } = planSource(ctx);
  if (!doc) return { doc: null, pieces: [], missing: ctx.unit.taskIds };
  if (lite) return { doc, pieces: [{ whole: true, text: emitWholeDoc(doc), body: doc.lines.join('\n') }], missing: [] };
  const pieces = [];
  const missing = [];
  for (const id of ctx.unit.taskIds) {
    const heading = resolveTaskHeading(doc.headings, id);
    if (!heading) missing.push(id);
    else pieces.push({ id, heading, text: emitSection(doc, heading), body: sectionText(doc, heading) });
  }
  return { doc, pieces, missing };
}

function stripUsage(task) {
  const { usage: _usage, ...rest } = task;
  return rest;
}

function refsSelector(ctx) {
  const entries = ctx.unitTasks();
  const plan = planPieces(ctx);
  const unitText = [...plan.pieces.map((piece) => piece.body), ...entries.map((task) => JSON.stringify(stripUsage(task)))].join('\n');
  const docs = {};
  for (const name of Object.keys(CYCLE_DOCS)) docs[name] = ctx.load(ctx.cyclePath(CYCLE_DOCS[name]));
  const selected = new Map();
  const add = (name, heading) => {
    if (!selected.has(name)) selected.set(name, new Set());
    selected.get(name).add(heading);
  };
  const failed = [];
  for (const entry of entries) {
    for (const ref of Array.isArray(entry.refs) ? entry.refs : []) {
      const parsed = parseExplicitRef(ref);
      const doc = parsed ? docs[parsed.doc] : null;
      const resolved = doc ? resolveWithParents(doc.headings, parsed.token) : null;
      if (resolved?.heading) add(parsed.doc, resolved.heading);
      else failed.push({ ref, doc: parsed && docs[parsed.doc] ? parsed.doc : null });
    }
  }
  for (const name of ['architect', 'functional']) {
    const doc = docs[name];
    if (!doc) continue;
    const ids = new Map();
    for (const heading of doc.headings) {
      const id = headingId(heading.text);
      if (id && !ids.has(id)) ids.set(id, heading);
    }
    for (const id of mentionedIds(unitText, new Set(ids.keys()))) add(name, ids.get(id));
  }
  for (const problem of rangeProblems(unitText)) if (!ctx.unresolved.includes(problem)) ctx.unresolved.push(problem);
  const parts = [];
  for (const name of ['architect', 'functional', 'planner', 'plan']) {
    const doc = docs[name];
    if (!doc) continue;
    const headings = dedupeNested([...(selected.get(name) ?? [])]);
    if (headings.length) {
      ctx.touch(doc);
      parts.push(...headings.map((heading) => emitSection(doc, heading)));
    } else if (name === 'architect' || name === 'functional') {
      ctx.touch(doc);
      parts.push(`(la unidad no referencia secciones de ${CYCLE_DOCS[name]}; ${INDEX_HINT})\n${srcLine(doc.path, 1, Math.max(doc.lines.length, 1))}\n${indexLines(doc).join('\n') || '(sin encabezados)'}`);
    }
  }
  const indexed = new Set();
  for (const miss of failed) {
    if (!ctx.unresolved.includes(miss.ref)) ctx.unresolved.push(miss.ref);
    const doc = miss.doc ? docs[miss.doc] : null;
    if (doc && !indexed.has(miss.doc)) {
      indexed.add(miss.doc);
      ctx.trailers.push({
        title: `Índice de ${doc.path.split('/').pop()} (refs sin resolver)`,
        body: `${INDEX_HINT}\n${srcLine(doc.path, 1, Math.max(doc.lines.length, 1))}\n${indexLines(doc).join('\n') || '(sin encabezados)'}`,
      });
    }
  }
  if (!docs.architect && !docs.functional && parts.length === 0) return noSource('el ciclo no tiene architect.md ni functional.md');
  return parts.join('\n\n') || noSource('la unidad no referencia nada');
}

function appContextDir(ctx) {
  return `${SDD_DIR}/context/${ctx.app}`;
}

function contextSelector(ctx, selector) {
  if (!ctx.app) return noSource('sin subproyecto resuelto');
  const dir = appContextDir(ctx);
  const prompt = ctx.load(`${dir}/context_prompt.md`);
  const constitution = ctx.load(`${dir}/constitution.md`);
  const parts = [];
  if (prompt) parts.push(emitWholeDoc(ctx.touch(prompt)));
  if (constitution) {
    ctx.touch(constitution);
    if (selector.index || constitution.bytes > ctx.limits.context_inline_max_bytes) {
      const words = ctx.contextAlways.map(normalizeHeading);
      const always = selector.index
        ? []
        : dedupeNested(constitution.headings.filter((heading) => words.some((word) => word && normalizeHeading(heading.text).includes(word))));
      const header = selector.index
        ? `Índice de constitution.md — ${INDEX_HINT}`
        : `constitution.md (${constitution.bytes} bytes) supera ${ctx.limits.context_inline_max_bytes}: índice y secciones siempre-vigentes — ${INDEX_HINT}`;
      parts.push(`${header}\n${srcLine(constitution.path, 1, Math.max(constitution.lines.length, 1))}\n${indexLines(constitution).join('\n') || '(sin encabezados)'}`);
      for (const heading of always) parts.push(emitSection(constitution, heading));
    } else parts.push(emitWholeDoc(constitution));
  }
  if (!selector.index) {
    for (const name of ctx.io.list(`${dir}/updates`).filter((entry) => !entry.dir && entry.name.endsWith('.md')).map((entry) => entry.name).sort()) {
      const doc = ctx.load(`${dir}/updates/${name}`);
      if (doc) parts.push(emitWholeDoc(ctx.touch(doc)));
    }
  }
  return parts.join('\n\n') || noSource(`${dir}/ no tiene contexto`);
}

function registryEntries(value) {
  if (!value || typeof value !== 'object') return [];
  for (const key of ENTRY_LISTS) if (Array.isArray(value[key])) return value[key];
  const list = Object.values(value).find(Array.isArray);
  return list ?? [];
}

function entryLabel(entry) {
  if (!entry || typeof entry !== 'object') return String(entry);
  const where = entry.path ?? entry.name ?? entry.table ?? entry.id ?? '(sin nombre)';
  const method = typeof entry.method === 'string' ? `${entry.method} ` : '';
  return `${method}${where}${entry.status ? ` · ${entry.status}` : ''}`;
}

function registryValue(ctx, registry) {
  if (!ctx.app) return { error: 'sin subproyecto resuelto' };
  const path = `${SDD_DIR}/${REGISTRY_FILES[registry]}`;
  const loaded = ctx.json(path);
  if (!loaded) return { error: `${path} no existe o no es JSON` };
  const keys = [ctx.app, bareName(ctx.app)];
  const key = keys.find((candidate) => !candidate.startsWith('_') && candidate in (loaded.value ?? {}));
  if (!key) return { error: `${path} sin entradas para ${ctx.app}` };
  ctx.touch(loaded.doc);
  return { path, value: loaded.value[key] };
}

function registrySelector(ctx, selector) {
  const found = registryValue(ctx, selector.registry);
  if (found.error) return noSource(found.error);
  if (selector.index) return `<!-- src: ${found.path} -->\n${registryEntries(found.value).map((entry) => `- ${entryLabel(entry)}`).join('\n') || '(sin entradas)'}`;
  return `<!-- src: ${found.path} -->\n${fenceJson(found.value)}`;
}

function quietly(ctx, compute) {
  const marks = { used: ctx.used.length, trailers: ctx.trailers.length, unresolved: ctx.unresolved.length };
  try {
    return compute();
  } finally {
    ctx.used.length = marks.used;
    ctx.trailers.length = marks.trailers;
    ctx.unresolved.length = marks.unresolved;
  }
}

export function mentionsPath(text, path) {
  if (typeof path !== 'string' || path.length < 2) return false;
  let from = 0;
  for (;;) {
    const at = text.indexOf(path, from);
    if (at < 0) return false;
    const next = text[at + path.length];
    if (next === undefined || !/[A-Za-z0-9_/-]/.test(next) || text.startsWith('/:', at + path.length)) return true;
    from = at + 1;
  }
}

function registryUnitSelector(ctx) {
  const found = registryValue(ctx, 'api');
  if (found.error) return noSource(found.error);
  const sourceText = quietly(ctx, () => ['tasks-unit', 'plan-unit', 'refs-unit'].map((kind) => runSelector(ctx, { kind, raw: kind })).join('\n'));
  const entries = registryEntries(found.value);
  const matching = entries.filter((entry) => mentionsPath(sourceText, entry?.path));
  if (!matching.length) return `<!-- src: ${found.path} -->\n${entries.map((entry) => `- ${entryLabel(entry)}`).join('\n') || '(sin entradas)'}`;
  return `<!-- src: ${found.path} -->\n${fenceJson(matching)}`;
}

function verifySelector(ctx) {
  if (!ctx.app) return noSource('sin subproyecto resuelto');
  const path = `${SDD_DIR}/verify.json`;
  const loaded = ctx.json(path);
  if (!loaded) return noSource(`${path} no existe o no es JSON`);
  const ref = resolveEntryId(loaded.value, ctx.app);
  if (ref.error) return noSource(`${path} sin entrada para ${ctx.app}`);
  ctx.touch(loaded.doc);
  const entry = loaded.value[ref.id];
  const lines = [`<!-- src: ${path} (entrada ${ref.id}) -->`];
  for (const level of ['quick', 'full']) for (const command of entry[level] ?? []) lines.push(`- ${level}: \`${command}\``);
  lines.push(`pnpm sdd:verify ${ref.id} quick --files <a,b> --unit TASK-NNN`);
  lines.push(`pnpm sdd:verify ${ref.id} full --unit B-NN`);
  return lines.join('\n');
}

function verifyResultsSelector(ctx) {
  const root = ctx.cyclePath('artifacts/verify');
  const files = [];
  for (const entry of ctx.io.list(root)) {
    if (!entry.dir && entry.name.endsWith('.json')) files.push(`${root}/${entry.name}`);
    else if (entry.dir && entry.name !== 'logs') {
      for (const inner of ctx.io.list(`${root}/${entry.name}`)) if (!inner.dir && inner.name.endsWith('.json')) files.push(`${root}/${entry.name}/${inner.name}`);
    }
  }
  const lines = [];
  for (const path of files.sort()) {
    const loaded = ctx.json(path);
    if (!loaded || typeof loaded.value !== 'object') continue;
    ctx.touch(loaded.doc);
    const r = loaded.value;
    lines.push(`- ${r.app ?? '?'} · ${r.unit ?? 'cycle'} · ${r.level ?? '?'} · ${r.ok ? 'ok' : 'FAILED'} · ${String(r.commit ?? '-').slice(0, 7)} · ${formatDuration(r.duration_ms ?? 0)}`);
  }
  return lines.join('\n') || noSource('sin resultados en artifacts/verify');
}

function acceptanceSelector(ctx) {
  const doc = ctx.load(ctx.cyclePath(CYCLE_DOCS.functional));
  if (!doc) return noSource('functional.md no existe');
  const headingByLine = new Map(doc.headings.map((heading) => [heading.line, heading]));
  const masked = maskedLines(doc.lines);
  const groups = [];
  let current = null;
  doc.lines.forEach((line, index) => {
    if (masked.has(index)) return;
    if (headingByLine.has(index + 1)) {
      current = { heading: headingByLine.get(index + 1), lines: [], last: index + 1 };
      return;
    }
    if (current && CRITERION_RE.test(line)) {
      current.lines.push(line);
      current.last = index + 1;
      if (current.lines.length === 1) groups.push(current);
    }
  });
  if (!groups.length) return noSource('functional.md sin criterios CA-…');
  ctx.touch(doc);
  return groups.map((group) => `${srcLine(doc.path, group.heading.line, group.last)}\n${headingLine(group.heading)}\n${group.lines.join('\n')}`).join('\n\n');
}

function cycleSelector(ctx) {
  const loaded = ctx.cycleJson();
  if (!loaded) return noSource(`${ctx.cyclePath('cycle.json')} no existe o no es JSON`);
  ctx.touch(loaded.doc);
  const c = loaded.value;
  const lines = [
    `<!-- src: ${loaded.doc.path} -->`,
    `- spec: ${c.spec ?? ctx.specId}`,
    `- ciclo: ${ctx.cycleId}`,
    `- flow: ${c.flow ?? 'full'}`,
    `- apps: ${(c.apps ?? []).join(', ') || '(ninguna)'}`,
  ];
  if (Array.isArray(c.objectives) && c.objectives.length) {
    lines.push('- objectives:');
    for (const objective of c.objectives) lines.push(`  - ${objective}`);
  }
  const brief = ctx.load(ctx.cyclePath('brief.yaml'));
  if (brief) {
    ctx.touch(brief);
    for (const key of ['objective', 'scope', 'out_of_scope', 'facts']) {
      const block = yamlBlock(brief.lines, key);
      if (block) lines.push('', srcLine(brief.path, block.from, block.to), ...brief.lines.slice(block.from - 1, block.to));
    }
  }
  return lines.join('\n');
}

export function yamlBlock(lines, key) {
  const start = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (start < 0) return null;
  let end = start;
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (!/^[ \t]/.test(line) && !/^-( |$)/.test(line)) break;
    end = index;
  }
  return { from: start + 1, to: end + 1 };
}

export function isInsideSdd(relativePath) {
  const text = String(relativePath ?? '');
  if (!text || text.startsWith('/') || text.startsWith('\\') || /^[A-Za-z]:/.test(text) || text.includes('\0')) return false;
  return text.split(/[\\/]+/).every((segment) => segment !== '..');
}

function sectionSelector(ctx, selector) {
  if (!isInsideSdd(selector.path)) return noSource(`ruta fuera de ${SDD_DIR}/: ${selector.path}`);
  const path = `${SDD_DIR}/${selector.path}`;
  const doc = ctx.load(path);
  if (!doc) return noSource(`${path} no existe`);
  const resolved = resolveToken(doc.headings, selector.token);
  if (!resolved.heading) return noSource(`sección «${selector.token}» no resuelta en ${path} (${resolved.reason})`);
  ctx.touch(doc);
  return emitSection(doc, resolved.heading);
}

function docSelector(ctx, selector) {
  const doc = ctx.load(ctx.cyclePath(CYCLE_DOCS[selector.doc]));
  if (!doc) return noSource(`${CYCLE_DOCS[selector.doc]} no existe en el ciclo`);
  ctx.touch(doc);
  if (selector.kind === 'doc') return emitWholeDoc(doc);
  return `${srcLine(doc.path, 1, Math.max(doc.lines.length, 1))}\n${indexLines(doc).join('\n') || '(sin encabezados)'}`;
}

function runSelector(ctx, selector) {
  switch (selector.kind) {
    case 'cycle':
      return cycleSelector(ctx);
    case 'spec': {
      const doc = ctx.load(`${ctx.specFolder}/${ctx.specId}.spec.md`);
      return doc ? emitWholeDoc(ctx.touch(doc)) : noSource(`${ctx.specFolder}/${ctx.specId}.spec.md no existe`);
    }
    case 'tasks-unit': {
      const loaded = ctx.tasksJson();
      if (!loaded) return noSource(`${ctx.cyclePath('tasks.json')} no existe o no es JSON`);
      ctx.touch(loaded.doc);
      return `<!-- src: ${loaded.doc.path} (${ctx.unit.taskIds.join(', ')}) -->\n${fenceJson(ctx.unitTasks().map(stripUsage))}`;
    }
    case 'tasks-summary': {
      const loaded = ctx.tasksJson();
      if (!loaded) return noSource(`${ctx.cyclePath('tasks.json')} no existe o no es JSON`);
      ctx.touch(loaded.doc);
      const lines = taskEntries(loaded.value).map(
        (task) => `- ${task.id} · ${task.status} · ${task.story_points ?? '?'} SP · ${task.title} · ${(task.files ?? []).length} files`,
      );
      return `<!-- src: ${loaded.doc.path} -->\n${lines.join('\n') || '(sin tasks)'}`;
    }
    case 'plan-unit': {
      const plan = planPieces(ctx);
      if (!plan.doc) return noSource('el ciclo no tiene planner.md ni plan.md');
      ctx.touch(plan.doc);
      const lines = plan.pieces.map((piece) => piece.text);
      for (const id of plan.missing) lines.push(noSource(`${plan.doc.path} sin sección de ${id}`));
      return lines.join('\n\n');
    }
    case 'refs-unit':
      return refsSelector(ctx);
    case 'index':
    case 'doc':
      return docSelector(ctx, selector);
    case 'context':
      return contextSelector(ctx, selector);
    case 'registry':
      return registrySelector(ctx, selector);
    case 'registry-unit':
      return registryUnitSelector(ctx);
    case 'verify':
      return verifySelector(ctx);
    case 'verify-results':
      return verifyResultsSelector(ctx);
    case 'acceptance':
      return acceptanceSelector(ctx);
    case 'section':
      return sectionSelector(ctx, selector);
    default:
      return noSource(`selector desconocido «${selector.raw}»`);
  }
}

const TITLES = {
  cycle: () => 'Ciclo',
  spec: () => 'Spec',
  'tasks-unit': () => 'Tasks de la unidad',
  'tasks-summary': () => 'Tasks del ciclo (resumen)',
  'plan-unit': () => 'Plan de la unidad',
  'refs-unit': () => 'Referencias de la unidad',
  index: (s) => `Índice de ${s.doc}`,
  doc: (s) => `Documento ${s.doc}`,
  context: (s, ctx) => `Contexto de ${ctx.app ?? 'el subproyecto'}${s.index ? ' (índice)' : ''}`,
  registry: (s, ctx) => `Registro ${s.registry} de ${ctx.app ?? 'el subproyecto'}${s.index ? ' (índice)' : ''}`,
  'registry-unit': (_s, ctx) => `Registro api de ${ctx.app ?? 'el subproyecto'} (endpoints de la unidad)`,
  verify: (_s, ctx) => `Verificación de ${ctx.app ?? 'el subproyecto'}`,
  'verify-results': () => 'Resultados de verificación',
  acceptance: () => 'Criterios de aceptación',
  section: (s) => `${s.path}#${s.token}`,
  invalid: (s) => `Selector ${s.raw}`,
};

export function buildPack({ ctx, role, include }) {
  const sections = [];
  for (const raw of include ?? []) {
    const selector = parseSelector(raw);
    const body = ctx.get(raw);
    sections.push({ title: (TITLES[selector.kind] ?? TITLES.invalid)(selector, ctx), body });
  }
  for (const trailer of ctx.trailers) sections.push(trailer);
  const rendered = sections.map((section, index) => `# [${index + 1}] ${section.title}\n${section.body}`).join('\n\n');
  const sources = ctx.used.map((doc) => `${doc.path}@${doc.sha}`).join(' · ') || '(ninguna)';
  const unresolvedLine = ctx.unresolved.length ? ctx.unresolved.join(', ') : 'ninguna';
  const head = [
    `# Pack · ${ctx.specId} · ${ctx.cycleId} · ${ctx.unit.id} · ${role}`,
    `> Generado por \`pnpm sdd:pack\` (${ctx.now}). Derivado: no se edita ni se commitea.`,
    '> Este paquete es tu contexto. Si te falta algo, leé la fuente que indica cada sección y',
    '> avisalo en tu respuesta (pack-miss) para que el paquete se ajuste.',
    `> Fuentes: ${sources}`,
    `> Refs sin resolver: ${unresolvedLine}`,
  ];
  const draft = `${head.join('\n')}\n\n${rendered}\n`;
  const draftBytes = Buffer.byteLength(draft);
  const max = ctx.limits.max_pack_bytes;
  let text = draft;
  let oversize = false;
  if (draftBytes > max) {
    oversize = true;
    head.splice(2, 0, `> ⚠ Paquete de ${draftBytes} bytes: supera max_pack_bytes (${max}); no se trunca.`);
    text = `${head.join('\n')}\n\n${rendered}\n`;
  }
  const sourceBytes = ctx.used.reduce((sum, doc) => sum + doc.bytes, 0);
  return { text, packBytes: Buffer.byteLength(text), sourceBytes, oversize, unresolved: [...ctx.unresolved], sources: ctx.used.map((doc) => doc.path) };
}

export const approxKTokens = (bytes) => (bytes / 4000).toFixed(1);

export function summaryLine(path, result) {
  return `${path} · ${result.packBytes} bytes (~${approxKTokens(result.packBytes)}k tokens) · sources ${result.sourceBytes} bytes`;
}

export function packFileName(unitId, role) {
  return `${unitId}.${role}.md`;
}

export function statsUnits({ tasksJson, roleDef, role }) {
  if (roleDef.unit === 'cycle') return [{ kind: 'cycle', id: 'cycle', taskIds: [], app: null }];
  const batches = batchEntries(tasksJson);
  if (batches.length)
    return batches
      .filter((batch) => batch.role === role)
      .map((batch) => ({ kind: 'batch', id: batch.id, taskIds: idList(batch.tasks), app: typeof batch.app === 'string' ? batch.app : null }));
  return taskEntries(tasksJson).map((task) => ({ kind: 'tasks', id: task.id, taskIds: [task.id], app: null }));
}

export function topPackMisses(tasks, limit = 5) {
  const counts = new Map();
  for (const task of Array.isArray(tasks) ? tasks : [])
    for (const path of Array.isArray(task?.usage?.pack_misses) ? task.usage.pack_misses : [])
      if (typeof path === 'string') counts.set(path, (counts.get(path) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, limit)
    .map(([path, count]) => ({ path, count }));
}

export function unresolvedExplicitRefs(io, cycleDir) {
  const read = (name) => {
    const buffer = io.read(`${cycleDir}/${name}`);
    if (buffer === null || buffer === undefined) return null;
    return { headings: parseHeadings(splitLines(buffer)) };
  };
  const tasksBuffer = io.read(`${cycleDir}/tasks.json`);
  if (!tasksBuffer) return [];
  let tasksJson;
  try {
    tasksJson = JSON.parse(normalizeText(tasksBuffer));
  } catch {
    return [];
  }
  const docs = {};
  const missing = [];
  for (const task of taskEntries(tasksJson)) {
    for (const ref of Array.isArray(task.refs) ? task.refs : []) {
      const parsed = parseExplicitRef(ref);
      if (parsed && !(parsed.doc in docs)) docs[parsed.doc] = CYCLE_DOCS[parsed.doc] ? read(CYCLE_DOCS[parsed.doc]) : null;
      const doc = parsed ? docs[parsed.doc] : null;
      if (!doc || !resolveWithParents(doc.headings, parsed.token).heading) missing.push({ task: task.id, ref });
    }
  }
  return missing;
}
