export const SESSION_TTL_MS = 30 * 60 * 1000;
export const BIND_MARKER = 'SDD-BIND';
export const REGISTRY_DIR_NAME = 'sdd-sessions';
export const NO_GIT_REGISTRY_DIR = 'sdd/.sessions';

const SESSION_FILE = /^[A-Za-z0-9._-]+$/;
const MARKER_LINE = /^SDD-BIND\s+(.+)$/gm;
const SPEC_IN_BRANCH = /spec-[A-Za-z0-9]+-\d{3}/;

export function toPosix(path) {
  return String(path).replace(/\\/g, '/').replace(/\/+$/, '');
}

function joinPath(...parts) {
  return parts.map((part, index) => (index === 0 ? toPosix(part) : toPosix(part).replace(/^\/+/, ''))).join('/');
}

function isAbsolute(path) {
  return path.startsWith('/') || /^[A-Za-z]:\//.test(path);
}

function parentOf(path) {
  const posix = toPosix(path);
  return posix.slice(0, posix.lastIndexOf('/'));
}

function resolveFrom(base, target) {
  const raw = toPosix(target);
  const full = isAbsolute(raw) ? raw : `${toPosix(base)}/${raw}`;
  const drive = /^[A-Za-z]:/.exec(full)?.[0] ?? '';
  const parts = [];
  for (const part of full.slice(drive.length).split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `${drive}/${parts.join('/')}`;
}

async function readOptional(fs, path) {
  try {
    return await fs.read(path);
  } catch {
    return null;
  }
}

async function gitDirOf(fs, repoRoot) {
  const dotGit = joinPath(repoRoot, '.git');
  const pointer = await readOptional(fs, dotGit);
  if (pointer === null) {
    const head = await readOptional(fs, joinPath(dotGit, 'HEAD'));
    return head === null ? null : { gitDir: dotGit, commonDir: dotGit };
  }
  const match = /^gitdir:\s*(.+)$/m.exec(pointer);
  if (!match) return null;
  const gitDir = resolveFrom(toPosix(repoRoot), match[1].trim());
  const common = await readOptional(fs, joinPath(gitDir, 'commondir'));
  const commonDir = common === null ? gitDir : resolveFrom(gitDir, common.trim());
  return { gitDir, commonDir };
}

export async function resolveRegistryDir(fs, repoRoot) {
  const git = await gitDirOf(fs, repoRoot);
  return git ? joinPath(git.commonDir, REGISTRY_DIR_NAME) : joinPath(repoRoot, NO_GIT_REGISTRY_DIR);
}

export async function readBranch(fs, repoRoot) {
  const git = await gitDirOf(fs, repoRoot);
  if (!git) return null;
  const head = await readOptional(fs, joinPath(git.gitDir, 'HEAD'));
  const ref = head && /^ref:\s*refs\/heads\/(.+)$/m.exec(head);
  return ref ? ref[1].trim() : null;
}

export function unitKey(unit) {
  return unit.kind === 'fix' ? unit.fix : `${unit.spec}/${unit.cycle}`;
}

export function sameUnit(a, b) {
  return Boolean(a && b) && unitKey(a) === unitKey(b);
}

export function formatBindMarker(unit) {
  return unit.kind === 'fix'
    ? `${BIND_MARKER} fix=${unit.fix}`
    : `${BIND_MARKER} spec=${unit.spec} cycle=${unit.cycle}`;
}

function unitFromMarkerFields(fields) {
  const values = Object.fromEntries(
    fields
      .split(/\s+/)
      .map((pair) => pair.split('='))
      .filter((pair) => pair.length === 2 && pair[0] && pair[1]),
  );
  if (values.fix) return { kind: 'fix', fix: values.fix };
  if (values.spec && /^cycle-\d{2}$/.test(values.cycle ?? '')) {
    return { kind: 'cycle', spec: values.spec, cycle: values.cycle };
  }
  return null;
}

export function parseBindMarker(text) {
  let last = null;
  for (const match of String(text ?? '').matchAll(MARKER_LINE)) {
    last = unitFromMarkerFields(match[1].trim()) ?? last;
  }
  return last;
}

export function openUnitsOf(cycles, fixes) {
  return [
    ...cycles.map((cycle) => ({ kind: 'cycle', spec: cycle.spec, cycle: cycle.cycle })),
    ...fixes.map((fix) => ({ kind: 'fix', fix: fix.id })),
  ];
}

export function unitFromBranch(branch, openUnits) {
  const spec = branch ? SPEC_IN_BRANCH.exec(branch)?.[0] : null;
  if (!spec) return null;
  const matches = openUnits.filter((unit) => unit.kind === 'cycle' && unit.spec.startsWith(spec));
  return matches.length === 1 ? matches[0] : null;
}

export function isBindingLive(binding, now) {
  if (!binding || binding.ended_at) return false;
  const touched = Date.parse(binding.updated_at);
  return Number.isFinite(touched) && now - touched < SESSION_TTL_MS;
}

function sessionFile(dir, sessionId) {
  if (!SESSION_FILE.test(sessionId)) throw new Error(`invalid session id: ${sessionId}`);
  return joinPath(dir, 'sessions', `${sessionId}.json`);
}

export async function readBinding(fs, dir, sessionId) {
  const text = await readOptional(fs, sessionFile(dir, sessionId));
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeBinding(fs, dir, { sessionId, unit, worktree, harness, source, now }) {
  const binding = {
    session_id: sessionId,
    unit,
    worktree: toPosix(worktree),
    harness,
    source,
    bound_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
    ended_at: null,
  };
  const previous = await readBinding(fs, dir, sessionId);
  if (previous && !previous.ended_at && sameUnit(previous.unit, unit)) binding.bound_at = previous.bound_at;
  await fs.write(sessionFile(dir, sessionId), `${JSON.stringify(binding, null, 2)}\n`);
  return binding;
}

export async function touchBinding(fs, dir, sessionId, now) {
  const binding = await readBinding(fs, dir, sessionId);
  if (!binding || binding.ended_at) return null;
  const next = { ...binding, updated_at: new Date(now).toISOString() };
  await fs.write(sessionFile(dir, sessionId), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

export async function endBinding(fs, dir, sessionId, now) {
  const binding = await readBinding(fs, dir, sessionId);
  if (!binding || binding.ended_at) return null;
  const next = { ...binding, ended_at: new Date(now).toISOString() };
  await fs.write(sessionFile(dir, sessionId), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

export async function listLiveBindings(fs, dir, now) {
  let entries;
  try {
    entries = await fs.list(joinPath(dir, 'sessions'));
  } catch {
    return [];
  }
  const bindings = [];
  for (const entry of entries) {
    if (!entry.name.endsWith('.json')) continue;
    const binding = await readBinding(fs, dir, entry.name.slice(0, -'.json'.length));
    if (isBindingLive(binding, now)) bindings.push(binding);
  }
  return bindings.sort((a, b) => a.session_id.localeCompare(b.session_id));
}

export function autoBindUnit({ binding, openUnits, branch, now }) {
  if (isBindingLive(binding, now) && openUnits.some((unit) => sameUnit(unit, binding.unit))) return null;
  if (openUnits.length === 1) return { unit: openUnits[0], source: 'single-unit' };
  const fromBranch = unitFromBranch(branch, openUnits);
  return fromBranch ? { unit: fromBranch, source: 'branch' } : null;
}

function useCommandsFor(openUnits) {
  return openUnits
    .map((unit) => (unit.kind === 'fix' ? `pnpm sdd:use ${unit.fix}` : `pnpm sdd:use ${unit.spec} ${unit.cycle}`))
    .join(' · ');
}

export function judgeSessionEdit({ gate, binding, openUnits, rel, now }) {
  if (openUnits.length === 0) {
    return verdictFor(
      gate,
      'none',
      `SPEC GATE: no hay ningún ciclo in-progress ni un fix abierto, así que todavía no se escribe código (${rel}). Abrí un ciclo (pnpm sdd:gate <spec> → sdd-orchestrator) o registrá el cambio con [FIX]/[BUGFIX]/[HOTFIX]. Reglas: sdd/dual-harness/rules/sdd-gates.md.`,
    );
  }
  const live = isBindingLive(binding, now);
  if (live && openUnits.some((unit) => sameUnit(unit, binding.unit))) return { kind: 'allow' };
  if (live) {
    return verdictFor(
      gate,
      'closed',
      `SPEC GATE: esta sesión está atada a ${unitKey(binding.unit)}, que ya no está abierto, así que no escribe código (${rel}). Elegí una unidad abierta: ${useCommandsFor(openUnits)}.`,
    );
  }
  if (openUnits.length === 1) return { kind: 'allow' };
  return verdictFor(
    gate,
    'unbound',
    `SPEC GATE: hay ${openUnits.length} unidades abiertas y esta sesión no está atada a ninguna, así que no escribe código (${rel}). ¿En cuál trabajás? ${useCommandsFor(openUnits)}.`,
  );
}

function verdictFor(gate, code, reason) {
  return { kind: gate === 'warn' ? 'warn' : 'deny', code, reason };
}
