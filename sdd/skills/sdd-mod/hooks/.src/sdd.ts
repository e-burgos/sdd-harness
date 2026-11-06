// Pure SDD logic of the mod: reads sdd/ through a small reader and judges edits. No import
// from 'claude-code' at run time, so the CLI's own vitest suite exercises it as is.
import type {
  ActiveCycle,
  CycleTask,
  ModSettings,
  OpenFix,
  SessionBinding,
  Snapshot,
  UnitRef,
} from '../../.claude-plugin/contract';
import {
  acquireLease,
  autoBindUnit,
  endBinding,
  inboxText,
  judgeFileLease,
  listInbox,
  listLiveLeases,
  markInboxRead,
  readLease,
  releaseSessionLeases,
  requestLease,
  judgeSessionEdit,
  listLiveBindings,
  openUnitsOf,
  parseBindMarker,
  readBinding,
  readBranch,
  resolveRegistryDir,
  sameUnit,
  touchBinding,
  unitKey,
  writeBinding,
} from './session-registry.mjs';
import type { BindSource, FileLease, InboxMessage } from './session-registry.mjs';

export type Reader = {
  read: (path: string) => Promise<string>;
  list: (path: string) => Promise<{ name: string; kind: string }[]>;
};

export type SessionStore = Reader & { write: (path: string, text: string) => Promise<void> };

export type SessionContext = { id: string; now: number };

const HARNESS = 'claude-code' as const;
const BIND_COMMAND = /sdd:use|sdd:gate|spec-gate|sdd-use/;
const GATE_COMMAND = /sdd:gate|spec-gate/;
const OTHERS_SHOWN = 3;

export type Verdict =
  | { kind: 'allow' }
  | { kind: 'warn'; reason: string }
  | { kind: 'deny'; reason: string };

// Kit and harness surfaces are not "code": SDD records, agent config and root markdown.
const EXEMPT_DIRS = new Set([
  'sdd',
  '.claude',
  '.github',
  '.gemini',
  '.agents',
  '.agent',
  '.vscode',
  '.idea',
]);

const OPEN_FIX = new Set(['pending', 'in-progress']);

export function readSettings(tools: unknown): ModSettings {
  const mod = (tools as { claude_mod?: { enabled?: unknown; gate?: unknown } })
    ?.claude_mod;
  return {
    enabled: mod?.enabled === true,
    gate: mod?.gate === 'warn' ? 'warn' : 'block',
  };
}

async function readJson(reader: Reader, path: string): Promise<any> {
  return JSON.parse(await reader.read(path));
}

async function activeCycles(reader: Reader, root: string): Promise<ActiveCycle[]> {
  const index = await readJson(reader, `${root}/sdd/specs/index.json`);
  const out: ActiveCycle[] = [];
  for (const spec of index.specs ?? []) {
    if (spec.status === 'completed' || spec.status === 'cancelled') continue;
    const dir = `${root}/${spec.folder}/cycles`;
    const entries = await reader.list(dir).catch(() => []);
    for (const entry of entries) {
      if (!/^cycle-\d{2}$/.test(entry.name)) continue;
      const cycle = await readJson(reader, `${dir}/${entry.name}/cycle.json`).catch(
        () => null,
      );
      if (cycle?.status !== 'in-progress') continue;
      const tasks = await readJson(reader, `${dir}/${entry.name}/tasks.json`).catch(
        () => null,
      );
      out.push({
        spec: spec.id,
        title: spec.title ?? spec.id,
        cycle: entry.name,
        flow: cycle.flow ?? tasks?.flow ?? 'full',
        tasks: (tasks?.tasks ?? []).map(
          (t: CycleTask): CycleTask => ({ id: t.id, title: t.title, status: t.status }),
        ),
      });
    }
  }
  return out.sort((a, b) => `${a.spec}/${a.cycle}`.localeCompare(`${b.spec}/${b.cycle}`));
}

async function openFixes(reader: Reader, root: string): Promise<OpenFix[]> {
  const fixes = await readJson(reader, `${root}/sdd/fixes.json`).catch(() => null);
  return (fixes?.fixes ?? [])
    .filter((f: OpenFix) => OPEN_FIX.has(f.status))
    .map((f: OpenFix): OpenFix => ({ id: f.id, title: f.title, status: f.status }));
}

function emptySnapshot(settings: ModSettings, extra: Partial<Snapshot> = {}): Snapshot {
  return { settings, cycles: [], fixes: [], openUnits: [], mine: null, others: [], ...extra };
}

async function bindSession(
  store: SessionStore,
  root: string,
  dir: string,
  session: SessionContext,
  unit: UnitRef,
  source: BindSource,
): Promise<SessionBinding> {
  return writeBinding(store, dir, {
    sessionId: session.id,
    unit,
    worktree: root,
    harness: HARNESS,
    source,
    now: session.now,
  });
}

async function readSessionState(
  store: Reader,
  root: string,
  session: SessionContext,
): Promise<{ mine: SessionBinding | null; others: SessionBinding[]; dir: string }> {
  const dir = await resolveRegistryDir(store, root);
  const live = await listLiveBindings(store, dir, session.now);
  return {
    dir,
    mine: live.find((b) => b.session_id === session.id) ?? null,
    others: live.filter((b) => b.session_id !== session.id),
  };
}

export async function loadSnapshot(
  reader: Reader | SessionStore,
  root: string,
  session?: SessionContext,
): Promise<Snapshot> {
  const tools = await readJson(reader, `${root}/sdd/tools.json`).catch(() => null);
  const settings = readSettings(tools);
  if (!settings.enabled) return emptySnapshot(settings);
  try {
    const [cycles, fixes] = await Promise.all([
      activeCycles(reader, root),
      openFixes(reader, root),
    ]);
    const openUnits = openUnitsOf(
      cycles,
      fixes.map((f) => ({ id: f.id })),
    ) as UnitRef[];
    const base = emptySnapshot(settings, { cycles, fixes, openUnits });
    if (!session) return base;
    try {
      const state = await readSessionState(reader, root, session);
      let mine = state.mine;
      if ('write' in reader) {
        const decision = autoBindUnit({
          binding: mine,
          openUnits,
          branch: await readBranch(reader, root),
          now: session.now,
        });
        if (decision) {
          mine = await bindSession(reader, root, state.dir, session, decision.unit, decision.source);
        }
      }
      const leases = await listLiveLeases(reader, state.dir, session.now).catch(() => []);
      return { ...base, sessionId: session.id, mine, others: state.others, leases };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ...base, registryError: message.slice(0, 120) };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emptySnapshot(settings, { error: message.slice(0, 120) });
  }
}

export function outputText(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result === null || typeof result !== 'object') return '';
  const record = result as { stdout?: unknown; stderr?: unknown; result?: unknown; text?: unknown };
  return [outputText(record.result), outputText(record.text), outputText(record.stdout), outputText(record.stderr)]
    .filter((part) => part !== '')
    .join('\n');
}

export async function bindFromCommand(
  store: SessionStore,
  root: string,
  session: SessionContext,
  command: string,
  output: unknown,
): Promise<UnitRef | null> {
  if (!BIND_COMMAND.test(command)) return null;
  const unit = parseBindMarker(outputText(output)) as UnitRef | null;
  if (!unit) return null;
  const tools = await readJson(store, `${root}/sdd/tools.json`).catch(() => null);
  if (!readSettings(tools).enabled) return null;
  const [cycles, fixes] = await Promise.all([activeCycles(store, root), openFixes(store, root)]);
  const open = openUnitsOf(cycles, fixes.map((f) => ({ id: f.id }))) as UnitRef[];
  if (!open.some((candidate) => sameUnit(candidate, unit))) return null;
  const dir = await resolveRegistryDir(store, root);
  const source: BindSource = GATE_COMMAND.test(command) ? 'gate-b' : 'sdd-use';
  await bindSession(store, root, dir, session, unit, source);
  return unit;
}

export async function touchSession(store: SessionStore, root: string, session: SessionContext) {
  const dir = await resolveRegistryDir(store, root);
  return touchBinding(store, dir, session.id, session.now);
}

export async function endSession(store: SessionStore, root: string, session: SessionContext) {
  const dir = await resolveRegistryDir(store, root);
  await releaseSessionLeases(store, dir, session.id, session.now).catch(() => []);
  return endBinding(store, dir, session.id, session.now);
}

export type LeaseRequest = { toSessionId: string; text: string };

export type LeaseOutcome = { verdict: Verdict; request: LeaseRequest | null };

const ALLOW_OUTCOME: LeaseOutcome = { verdict: { kind: 'allow' }, request: null };

function requestTextFor(lease: FileLease, from: UnitRef | null, sessionId: string): string {
  const who = from ? unitKey(from) : sessionId;
  return `SDD: ${who} necesita ${lease.path}, que esta sesión tiene reservado. Si ya no lo vas a tocar, liberalo con pnpm sdd:release ${lease.path}.`;
}

export async function leaseEdit(
  store: SessionStore,
  snapshot: Snapshot,
  root: string,
  filePath: string,
  session: SessionContext,
): Promise<LeaseOutcome> {
  if (!snapshot.settings.enabled || snapshot.error || snapshot.registryError) return ALLOW_OUTCOME;
  const rel = relativeToRoot(root, filePath);
  if (rel === null || !isCodePath(rel)) return ALLOW_OUTCOME;
  const dir = await resolveRegistryDir(store, root);
  const unit = snapshot.mine?.unit ?? null;
  let lease = await readLease(store, dir, rel);
  const judge = (current: FileLease | null) =>
    judgeFileLease({ gate: snapshot.settings.gate, lease: current, sessionId: session.id, worktree: root, now: session.now });
  let verdict = judge(lease);
  if (verdict.kind === 'allow') {
    const taken = await acquireLease(store, dir, {
      rel,
      sessionId: session.id,
      unit,
      worktree: root,
      harness: HARNESS,
      now: session.now,
    });
    if (taken.acquired) return ALLOW_OUTCOME;
    lease = taken.lease;
    verdict = judge(lease);
  }
  if (verdict.kind === 'allow' || lease === null) return ALLOW_OUTCOME;
  const { created } = await requestLease(store, dir, { lease, fromSessionId: session.id, fromUnit: unit, now: session.now });
  return {
    verdict: { kind: verdict.kind, reason: verdict.reason },
    request: created ? { toSessionId: lease.session_id, text: requestTextFor(lease, unit, session.id) } : null,
  };
}

export async function unreadInbox(store: Reader, root: string, session: SessionContext): Promise<InboxMessage[]> {
  const dir = await resolveRegistryDir(store, root);
  return listInbox(store, dir, session.id);
}

export async function markInboxSeen(store: SessionStore, root: string, session: SessionContext, ids: string[]) {
  if (ids.length === 0) return;
  const dir = await resolveRegistryDir(store, root);
  await markInboxRead(store, dir, session.id, ids, session.now);
}

export function inboxSection(messages: InboxMessage[]): string | null {
  return messages.length === 0 ? null : inboxText(messages);
}

export function leasesOf(snapshot: Snapshot, sessionId: string): FileLease[] {
  return (snapshot.leases ?? []).filter((lease) => lease.session_id === sessionId);
}

export async function currentBinding(store: Reader, root: string, session: SessionContext) {
  const dir = await resolveRegistryDir(store, root);
  return readBinding(store, dir, session.id);
}

/** Path relative to the repo root with `/` separators, or null when it lands outside it. */
export function relativeToRoot(root: string, filePath: string): string | null {
  const norm = (p: string) => p.replace(/\\/g, '/');
  const base = norm(root).replace(/\/+$/, '');
  const raw = norm(filePath);
  const isAbsolute = raw.startsWith('/') || /^[A-Za-z]:\//.test(raw);
  const parts: string[] = [];
  for (const part of (isAbsolute ? raw : `${base}/${raw}`).split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  const full = (raw.startsWith('/') || base.startsWith('/') ? '/' : '') + parts.join('/');
  if (!full.startsWith(`${base}/`)) return null;
  return full.slice(base.length + 1);
}

export function isCodePath(rel: string): boolean {
  const [first, ...rest] = rel.split('/');
  if (rest.length === 0) return !/\.md$/i.test(first ?? '');
  return !EXEMPT_DIRS.has(first ?? '');
}

export function judgeEdit(
  snapshot: Snapshot,
  root: string,
  filePath: string,
  now: number = Date.now(),
): Verdict {
  if (!snapshot.settings.enabled || snapshot.error) return { kind: 'allow' };
  const rel = relativeToRoot(root, filePath);
  if (rel === null || !isCodePath(rel)) return { kind: 'allow' };
  if (snapshot.registryError && snapshot.openUnits.length > 0) return { kind: 'allow' };
  const verdict = judgeSessionEdit({
    gate: snapshot.settings.gate,
    binding: snapshot.mine,
    openUnits: snapshot.openUnits,
    rel,
    now,
  });
  return verdict.kind === 'allow' ? verdict : { kind: verdict.kind, reason: verdict.reason };
}

export function unitLabel(unit: UnitRef): string {
  return unitKey(unit);
}

export type Holder = 'mine' | 'other' | null;

export function holderOf(snapshot: Snapshot, unit: UnitRef): Holder {
  if (snapshot.mine && sameUnit(snapshot.mine.unit, unit)) return 'mine';
  return snapshot.others.some((b) => sameUnit(b.unit, unit)) ? 'other' : null;
}

export function progress(cycle: ActiveCycle): string {
  const counted = cycle.tasks.filter((t) => t.status !== 'skipped');
  const done = counted.filter((t) => t.status === 'done').length;
  return `${done}/${counted.length}`;
}

function mineSegment(snapshot: Snapshot): string {
  const unit = snapshot.mine?.unit;
  if (!unit) return 'esta sesión: sin unidad';
  const open = snapshot.openUnits.some((candidate) => sameUnit(candidate, unit));
  if (unit.kind === 'fix') return `esta sesión: ${unit.fix}${open ? '' : ' (cerrado)'}`;
  const cycle = snapshot.cycles.find((c) => c.spec === unit.spec && c.cycle === unit.cycle);
  if (!cycle) return `esta sesión: ${unit.spec} · ${unit.cycle} (cerrado)`;
  return `esta sesión: ${cycle.spec} · ${cycle.cycle} · ${cycle.flow} · ${progress(cycle)}`;
}

function othersSegment(snapshot: Snapshot): string | null {
  const rest = snapshot.openUnits.filter((unit) => !sameUnit(unit, snapshot.mine?.unit));
  if (rest.length === 0) return null;
  const shown = rest.slice(0, OTHERS_SHOWN).map(unitLabel);
  const hidden = rest.length - shown.length;
  return `otras: ${shown.join(', ')}${hidden > 0 ? `, +${hidden}` : ''}`;
}

/** One line for the band above the prompt; null when there is nothing to show. */
export function bandLine(snapshot: Snapshot): string | null {
  if (!snapshot.settings.enabled) return null;
  if (snapshot.error) return `SDD ▸ no pude leer sdd/ (${snapshot.error}) · gate en pausa`;
  if (snapshot.openUnits.length === 0) {
    const effect = snapshot.settings.gate === 'block' ? 'bloqueado' : 'con aviso';
    return `SDD ▸ sin ciclo ni fix en curso · escribir código: ${effect} · /sdd`;
  }
  const parts = [mineSegment(snapshot), othersSegment(snapshot)].filter(
    (part): part is string => part !== null,
  );
  return `SDD ▸ ${parts.join(' · ')} · /sdd`;
}
