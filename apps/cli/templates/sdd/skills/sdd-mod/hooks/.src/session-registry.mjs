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

export const LEASE_TTL_MS = SESSION_TTL_MS;

function fnv1a32(text, seed) {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function normalizeRel(rel) {
  return toPosix(rel).replace(/^\.\//, '').replace(/^\/+/, '');
}

export function leaseKey(rel) {
  const path = normalizeRel(rel);
  return `${fnv1a32(path, 0x811c9dc5)}${fnv1a32(path, 0x050c5d1f)}`;
}

function leaseFile(dir, rel) {
  return joinPath(dir, 'locks', `${leaseKey(rel)}.json`);
}

async function readJsonOptional(fs, path) {
  const text = await readOptional(fs, path);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function writeJson(fs, path, value) {
  await fs.write(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function isLeaseLive(lease, now) {
  if (!lease || lease.released_at) return false;
  const touched = Date.parse(lease.updated_at);
  return Number.isFinite(touched) && now - touched < LEASE_TTL_MS;
}

export async function readLease(fs, dir, rel) {
  const lease = await readJsonOptional(fs, leaseFile(dir, rel));
  return lease && lease.path === normalizeRel(rel) ? lease : null;
}

export async function listLiveLeases(fs, dir, now) {
  let entries;
  try {
    entries = await fs.list(joinPath(dir, 'locks'));
  } catch {
    return [];
  }
  const leases = [];
  for (const entry of entries) {
    if (!entry.name.endsWith('.json')) continue;
    const lease = await readJsonOptional(fs, joinPath(dir, 'locks', entry.name));
    if (lease && typeof lease.path === 'string' && isLeaseLive(lease, now)) leases.push(lease);
  }
  return leases.sort((a, b) => a.path.localeCompare(b.path));
}

export async function acquireLease(fs, dir, { rel, sessionId, unit, worktree, harness, now }) {
  const path = normalizeRel(rel);
  const current = await readLease(fs, dir, path);
  if (isLeaseLive(current, now) && current.session_id !== sessionId) {
    return { acquired: false, lease: current };
  }
  const stamp = new Date(now).toISOString();
  const keep = isLeaseLive(current, now) && current.session_id === sessionId;
  const lease = {
    path,
    session_id: sessionId,
    unit: unit ?? null,
    worktree: toPosix(worktree),
    harness,
    acquired_at: keep ? current.acquired_at : stamp,
    updated_at: stamp,
    released_at: null,
  };
  await writeJson(fs, leaseFile(dir, path), lease);
  const settled = await readLease(fs, dir, path);
  if (settled && settled.session_id !== sessionId) return { acquired: false, lease: settled };
  return { acquired: true, lease };
}

export async function releaseLease(fs, dir, rel, now, { sessionId } = {}) {
  const lease = await readLease(fs, dir, rel);
  if (!isLeaseLive(lease, now)) return null;
  if (sessionId && lease.session_id !== sessionId) return null;
  const next = { ...lease, released_at: new Date(now).toISOString() };
  await writeJson(fs, leaseFile(dir, lease.path), next);
  return next;
}

export async function releaseSessionLeases(fs, dir, sessionId, now) {
  const released = [];
  for (const lease of await listLiveLeases(fs, dir, now)) {
    if (lease.session_id !== sessionId) continue;
    const next = await releaseLease(fs, dir, lease.path, now, { sessionId });
    if (next) released.push(next);
  }
  return released;
}

function holderLabel(lease) {
  return lease.unit ? unitKey(lease.unit) : 'sin unidad';
}

function minutesSince(iso, now) {
  return Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
}

export function judgeFileLease({ gate, lease, sessionId, worktree, now }) {
  if (!isLeaseLive(lease, now) || lease.session_id === sessionId) return { kind: 'allow' };
  const holder = holderLabel(lease);
  const since = minutesSince(lease.updated_at, now);
  if (toPosix(lease.worktree) !== toPosix(worktree)) {
    return {
      kind: 'warn',
      code: 'leased-elsewhere',
      lease,
      reason: `SDD reserva: ${lease.path} lo está editando otra sesión desde otro worktree (${holder}, última edición hace ${since} min). La edición pasa, pero el choque llegaría en el merge; le dejé el aviso.`,
    };
  }
  return verdictFor(
    gate,
    'leased-here',
    `SDD reserva: ${lease.path} está reservado por otra sesión en esta misma carpeta (${holder}, última edición hace ${since} min), así que no lo edito para no pisarla. Le dejé el pedido: esperá a que lo libere (pnpm sdd:release ${lease.path}) o coordiná el cambio con esa sesión. La reserva vence sola a los ${LEASE_TTL_MS / 60000} min sin edición.`,
  );
}

function inboxDir(dir, sessionId) {
  if (!SESSION_FILE.test(sessionId)) throw new Error(`invalid session id: ${sessionId}`);
  return joinPath(dir, 'inbox', sessionId);
}

export function requestIdFor(kind, lease, fromSessionId) {
  const stamp = Date.parse(kind === 'lease-released' ? lease.released_at : lease.acquired_at);
  return `${kind === 'lease-released' ? 'rel' : 'req'}-${leaseKey(lease.path)}-${fromSessionId}-${stamp}`;
}

export async function writeInboxMessage(fs, dir, { kind, lease, toSessionId, fromSessionId, fromUnit, now }) {
  const id = requestIdFor(kind, lease, fromSessionId);
  const path = joinPath(inboxDir(dir, toSessionId), `${id}.json`);
  const existing = await readJsonOptional(fs, path);
  if (existing) return { created: false, message: existing };
  const message = {
    id,
    kind,
    path: lease.path,
    from_session: fromSessionId,
    from_unit: fromUnit ?? null,
    to_session: toSessionId,
    created_at: new Date(now).toISOString(),
    read_at: null,
  };
  await writeJson(fs, path, message);
  return { created: true, message };
}

export function requestLease(fs, dir, { lease, fromSessionId, fromUnit, now }) {
  return writeInboxMessage(fs, dir, {
    kind: 'lease-request',
    lease,
    toSessionId: lease.session_id,
    fromSessionId,
    fromUnit,
    now,
  });
}

export async function listInbox(fs, dir, sessionId, { unreadOnly = true } = {}) {
  let entries;
  try {
    entries = await fs.list(inboxDir(dir, sessionId));
  } catch {
    return [];
  }
  const messages = [];
  for (const entry of entries) {
    if (!entry.name.endsWith('.json')) continue;
    const message = await readJsonOptional(fs, joinPath(inboxDir(dir, sessionId), entry.name));
    if (message && typeof message.id === 'string' && (!unreadOnly || !message.read_at)) messages.push(message);
  }
  return messages.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function markInboxRead(fs, dir, sessionId, ids, now) {
  const wanted = new Set(ids);
  for (const message of await listInbox(fs, dir, sessionId)) {
    if (!wanted.has(message.id)) continue;
    await writeJson(fs, joinPath(inboxDir(dir, sessionId), `${message.id}.json`), {
      ...message,
      read_at: new Date(now).toISOString(),
    });
  }
}

export async function notifyRequesters(fs, dir, released, now) {
  const notified = [];
  for (const message of await listInbox(fs, dir, released.session_id, { unreadOnly: false })) {
    if (message.kind !== 'lease-request' || message.path !== released.path) continue;
    if (Date.parse(message.created_at) < Date.parse(released.acquired_at)) continue;
    const { created } = await writeInboxMessage(fs, dir, {
      kind: 'lease-released',
      lease: released,
      toSessionId: message.from_session,
      fromSessionId: released.session_id,
      fromUnit: released.unit,
      now,
    });
    if (created) notified.push(message.from_session);
  }
  return notified;
}

export function inboxText(messages) {
  const lines = messages.map((message) => {
    const who = message.from_unit ? unitKey(message.from_unit) : message.from_session;
    return message.kind === 'lease-released'
      ? `- ${message.path}: la sesión que lo tenía (${who}) lo liberó; ya podés editarlo.`
      : `- ${who} necesita ${message.path}, que esta sesión tiene reservado. Si ya no lo vas a tocar, liberalo con \`pnpm sdd:release ${message.path}\`; si lo seguís editando, terminá ese cambio y avisale al dev para coordinar.`;
  });
  return `Pedidos de otras sesiones SDD sobre archivos reservados:\n${lines.join('\n')}`;
}
