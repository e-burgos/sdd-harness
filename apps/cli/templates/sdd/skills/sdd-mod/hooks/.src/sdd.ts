// Pure SDD logic of the mod: reads sdd/ through a small reader and judges edits. No import
// from 'claude-code' at run time, so the CLI's own vitest suite exercises it as is.
import type {
  ActiveCycle,
  CycleTask,
  ModSettings,
  OpenFix,
  OpenSpec,
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
  isBindingLive,
  listLiveBindings,
  listWorktrees,
  openUnitsOf,
  parseBindTarget,
  readBinding,
  readBranch,
  resolveRegistryDir,
  sameUnit,
  toPosix,
  touchBinding,
  unitFromSpecPath,
  unitKey,
  worktreeOf,
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
  const mod = (tools as { claude_mod?: { enabled?: unknown; gate?: unknown; exempt?: unknown } })
    ?.claude_mod;
  return {
    enabled: mod?.enabled === true,
    gate: mod?.gate === 'warn' ? 'warn' : 'block',
    exempt: Array.isArray(mod?.exempt)
      ? mod.exempt.filter((g): g is string => typeof g === 'string' && g.length > 0)
      : [],
  };
}

async function readJson(reader: Reader, path: string): Promise<any> {
  return JSON.parse(await reader.read(path));
}

async function activeCycles(reader: Reader, root: string): Promise<ActiveCycle[]> {
  return (await readWorktree(reader, root)).cycles;
}

type WorktreeUnits = { cycles: ActiveCycle[]; fixes: OpenFix[]; specs: OpenSpec[] };

const FINAL_SPEC = new Set(['completed', 'cancelled']);

async function readWorktree(reader: Reader, root: string): Promise<WorktreeUnits> {
  const index = await readJson(reader, `${root}/sdd/specs/index.json`);
  const cycles = await cyclesOf(reader, root, index);
  const fixes = await openFixes(reader, root);
  const withCycle = new Set(cycles.map((cycle) => cycle.spec));
  const specs = (index.specs ?? [])
    .filter((spec: { id: string; status?: string }) => !FINAL_SPEC.has(spec.status ?? '') && !withCycle.has(spec.id))
    .map((spec: { id: string; title?: string }): OpenSpec => ({ spec: spec.id, title: spec.title ?? spec.id, worktree: root }));
  return { cycles, fixes, specs };
}

async function cyclesOf(reader: Reader, root: string, index: any): Promise<ActiveCycle[]> {
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
        worktree: root,
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
    .map((f: OpenFix): OpenFix => ({ id: f.id, title: f.title, status: f.status, type: f.type ?? null, worktree: root }));
}

function emptySnapshot(settings: ModSettings, extra: Partial<Snapshot> = {}): Snapshot {
  return { settings, cycles: [], fixes: [], openUnits: [], specs: [], root: '', worktrees: [], mine: null, others: [], ...extra };
}

function mergeUnits(parts: WorktreeUnits[]): WorktreeUnits {
  const seen = new Set<string>();
  const keep = <T>(key: string, item: T): T | null => {
    if (seen.has(key)) return null;
    seen.add(key);
    return item;
  };
  return {
    cycles: parts.flatMap((part) => part.cycles).filter((c) => keep(`${c.spec}/${c.cycle}`, c) !== null),
    fixes: parts.flatMap((part) => part.fixes).filter((f) => keep(f.id, f) !== null),
    specs: parts.flatMap((part) => part.specs).filter((s) => keep(`spec:${s.spec}`, s) !== null),
  };
}

async function readAllWorktrees(reader: Reader, root: string): Promise<{ worktrees: string[]; units: WorktreeUnits }> {
  const home = toPosix(root);
  const listed = await listWorktrees(reader, home).catch(() => [home]);
  const worktrees = [home, ...listed.filter((tree) => tree !== home)];
  const own = await readWorktree(reader, home);
  const rest = await Promise.all(worktrees.slice(1).map((tree) => readWorktree(reader, tree).catch(() => null)));
  const cycleSpecs = new Set([own, ...rest].flatMap((part) => part?.cycles ?? []).map((cycle) => cycle.spec));
  const units = mergeUnits([own, ...rest.filter((part): part is WorktreeUnits => part !== null)]);
  return { worktrees, units: { ...units, specs: units.specs.filter((spec) => !cycleSpecs.has(spec.spec)) } };
}

export function worktreeOfUnit(snapshot: Pick<Snapshot, 'cycles' | 'fixes' | 'specs' | 'root'>, unit: UnitRef): string {
  if (unit.kind === 'fix') return snapshot.fixes.find((fix) => fix.id === unit.fix)?.worktree ?? snapshot.root;
  if (unit.kind === 'spec') return (snapshot.specs ?? []).find((spec) => spec.spec === unit.spec)?.worktree ?? snapshot.root;
  return snapshot.cycles.find((c) => c.spec === unit.spec && c.cycle === unit.cycle)?.worktree ?? snapshot.root;
}

function unitsIn(snapshot: Snapshot, tree: string): UnitRef[] {
  if ((snapshot.worktrees ?? []).length === 0) return snapshot.openUnits;
  return snapshot.openUnits.filter((unit) => worktreeOfUnit(snapshot, unit) === tree);
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
  const live = await listLiveBindings(store, dir, session.now, { includeSpec: true });
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
    const { worktrees, units } = await readAllWorktrees(reader, root);
    const { cycles, fixes, specs } = units;
    const openUnits = openUnitsOf(
      cycles,
      fixes.map((f) => ({ id: f.id })),
    ) as UnitRef[];
    const base = emptySnapshot(settings, { cycles, fixes, specs, openUnits, root: toPosix(root), worktrees });
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
          const tree = worktreeOfUnit(base, decision.unit);
          mine = await bindSession(reader, tree, state.dir, session, decision.unit, decision.source);
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

export type BindOutcome = { bound: UnitRef; worktree: string } | { rejected: string } | null;

async function specFolderExists(reader: Reader, tree: string, spec: string): Promise<boolean> {
  return reader.list(`${tree}/sdd/specs/${spec}`).then(
    () => true,
    () => false,
  );
}

async function isBindable(reader: Reader, tree: string, unit: UnitRef): Promise<boolean> {
  const units = await readWorktree(reader, tree);
  if (unit.kind === 'spec') {
    return units.specs.some((spec) => spec.spec === unit.spec) || (await specFolderExists(reader, tree, unit.spec));
  }
  const open = openUnitsOf(units.cycles, units.fixes.map((f) => ({ id: f.id }))) as UnitRef[];
  return open.some((candidate) => sameUnit(candidate, unit));
}

function bindSourceOf(command: string, unit: UnitRef): BindSource {
  if (!GATE_COMMAND.test(command)) return 'sdd-use';
  return unit.kind === 'spec' ? 'gate-a' : 'gate-b';
}

export async function bindFromCommand(
  store: SessionStore,
  root: string,
  session: SessionContext,
  command: string,
  output: unknown,
): Promise<BindOutcome> {
  if (!BIND_COMMAND.test(command)) return null;
  const target = parseBindTarget(outputText(output));
  if (!target) return null;
  const tools = await readJson(store, `${root}/sdd/tools.json`).catch(() => null);
  if (!readSettings(tools).enabled) return null;
  const tree = target.worktree ?? toPosix(root);
  const bindable = await isBindable(store, tree, target.unit).catch(() => false);
  if (!bindable) {
    return { rejected: `SDD: no até la sesión a ${unitKey(target.unit)}: no está abierta en ${tree}.` };
  }
  const dir = await resolveRegistryDir(store, root);
  await bindSession(store, tree, dir, session, target.unit, bindSourceOf(command, target.unit));
  return { bound: target.unit, worktree: tree };
}

export async function bindFromEdit(
  store: SessionStore,
  snapshot: Snapshot,
  filePath: string,
  session: SessionContext,
): Promise<UnitRef | null> {
  if (!snapshot.settings.enabled || snapshot.error || snapshot.registryError) return null;
  const tree = worktreeOf(snapshot.worktrees ?? [], absoluteIn(snapshot.root ?? '', filePath));
  if (tree === null) return null;
  const rel = relativeToRoot(tree, filePath);
  if (rel === null) return null;
  const live = isBindingLive(snapshot.mine, session.now) ? snapshot.mine : null;
  const fromDocument = unitFromSpecPath(rel, unitsIn(snapshot, tree)) as UnitRef | null;
  let unit: UnitRef | null = null;
  let source: BindSource = 'document';
  if (fromDocument && !sameUnit(fromDocument, live?.unit)) unit = fromDocument;
  else if (!fromDocument && live === null && isCodePath(rel, snapshot.settings.exempt)) {
    const here = unitsIn(snapshot, tree);
    if (here.length === 1) {
      unit = here[0] ?? null;
      source = 'worktree';
    }
  }
  if (unit === null) return null;
  const dir = await resolveRegistryDir(store, snapshot.root);
  await bindSession(store, tree, dir, session, unit, source);
  return unit;
}

function absoluteIn(root: string, filePath: string): string {
  const raw = filePath.replace(/\\/g, '/');
  return raw.startsWith('/') || /^[A-Za-z]:\//.test(raw) ? raw : `${toPosix(root)}/${raw}`;
}

export function treeFor(snapshot: Snapshot, root: string, filePath: string): string {
  const trees = snapshot.worktrees ?? [];
  return worktreeOf(trees.length > 0 ? trees : [toPosix(root)], absoluteIn(root, filePath)) ?? toPosix(root);
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
  const dir = await resolveRegistryDir(store, root);
  root = treeFor(snapshot, root, filePath);
  const rel = relativeToRoot(root, filePath);
  if (rel === null || !isCodePath(rel, snapshot.settings.exempt)) return ALLOW_OUTCOME;
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

const CODE_ROOTS = new Set(['apps', 'libs', 'tools']);

function segmentMatches(pattern: string, text: string): boolean {
  let p = 0;
  let t = 0;
  let starP = -1;
  let starT = 0;
  while (t < text.length) {
    const c = pattern.charAt(p);
    if (p < pattern.length && c === '*') {
      starP = p;
      starT = t;
      p++;
    } else if (p < pattern.length && (c === '?' || c === text.charAt(t))) {
      p++;
      t++;
    } else if (starP !== -1) {
      starT++;
      t = starT;
      p = starP + 1;
    } else return false;
  }
  while (pattern.charAt(p) === '*') p++;
  return p === pattern.length;
}

function collapseDoubleStars(segments: string[]): string[] {
  return segments.filter((seg, i) => !(seg === '**' && segments[i - 1] === '**'));
}

export function matchesGlob(rel: string, glob: string): boolean {
  const patternSegments = collapseDoubleStars(glob.replace(/\\/g, '/').split('/'));
  const pathSegments = rel.split('/');
  const lastPattern = patternSegments.length - 1;
  const memo = new Map<number, boolean>();
  const width = pathSegments.length + 1;

  const match = (g: number, r: number): boolean => {
    const key = g * width + r;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let result: boolean;
    if (g > lastPattern) result = r === pathSegments.length;
    else if (patternSegments[g] === '**') {
      if (lastPattern === 0) result = true;
      else if (g === lastPattern) result = r < pathSegments.length;
      else {
        result = false;
        for (let skip = r; skip <= pathSegments.length && !result; skip++) {
          result = match(g + 1, skip);
        }
      }
    } else {
      result =
        r < pathSegments.length &&
        segmentMatches(patternSegments[g], pathSegments[r]) &&
        match(g + 1, r + 1);
    }
    memo.set(key, result);
    return result;
  };

  return match(0, 0);
}

export function isCodePath(rel: string, exempt: readonly string[] = []): boolean {
  const path = rel.replace(/\\/g, '/');
  const [first = ''] = path.split('/');
  if (EXEMPT_DIRS.has(first) && path.includes('/')) return false;
  if (exempt.some((glob) => matchesGlob(path, glob))) return false;
  if (CODE_ROOTS.has(first.toLowerCase()) && path.includes('/')) return true;
  return !/\.mdx?$/i.test(path);
}

export function judgeEdit(
  snapshot: Snapshot,
  root: string,
  filePath: string,
  now: number = Date.now(),
): Verdict {
  if (!snapshot.settings.enabled || snapshot.error) return { kind: 'allow' };
  const tree = treeFor(snapshot, root, filePath);
  const rel = relativeToRoot(tree, filePath);
  if (rel === null || !isCodePath(rel, snapshot.settings.exempt)) return { kind: 'allow' };
  if (snapshot.registryError && snapshot.openUnits.length > 0) return { kind: 'allow' };
  const bound = isBindingLive(snapshot.mine, now);
  const verdict = judgeSessionEdit({
    gate: snapshot.settings.gate,
    binding: snapshot.mine,
    openUnits: bound || (snapshot.worktrees ?? []).length === 0 ? snapshot.openUnits : unitsIn(snapshot, tree),
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

function baseName(path: string): string {
  const posix = toPosix(path);
  return posix.slice(posix.lastIndexOf('/') + 1);
}

function whereSuffix(snapshot: Snapshot): string {
  const tree = snapshot.mine?.worktree ? toPosix(snapshot.mine.worktree) : null;
  return tree && snapshot.root && tree !== snapshot.root ? ` · en ${baseName(tree)}` : '';
}

function unitSegment(snapshot: Snapshot, unit: UnitRef): string {
  if (unit.kind === 'spec') {
    const cycle = snapshot.cycles.find((c) => c.spec === unit.spec);
    return cycle ? `${unit.spec} · ciclo abierto` : `${unit.spec} · preparando la spec`;
  }
  const open = snapshot.openUnits.some((candidate) => sameUnit(candidate, unit));
  if (unit.kind === 'fix') {
    const fix = snapshot.fixes.find((f) => f.id === unit.fix);
    if (!fix || !open) return `${unit.fix} (cerrado)`;
    return fix.type ? `${unit.fix} · ${fix.type}` : unit.fix;
  }
  const cycle = snapshot.cycles.find((c) => c.spec === unit.spec && c.cycle === unit.cycle);
  if (!cycle) return `${unit.spec} · ${unit.cycle} (cerrado)`;
  return `${cycle.spec} · ${cycle.cycle} · ${cycle.flow} · ${progress(cycle)}`;
}

function mineSegment(snapshot: Snapshot): string {
  const unit = snapshot.mine?.unit;
  if (!unit) return 'esta sesión: sin unidad';
  return `esta sesión: ${unitSegment(snapshot, unit)}${whereSuffix(snapshot)}`;
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
  if (snapshot.openUnits.length === 0 && snapshot.mine?.unit.kind !== 'spec') {
    const effect = snapshot.settings.gate === 'block' ? 'bloqueado' : 'con aviso';
    return `SDD ▸ sin ciclo ni fix en curso · escribir código: ${effect} · /sdd`;
  }
  const parts = [mineSegment(snapshot), othersSegment(snapshot)].filter(
    (part): part is string => part !== null,
  );
  return `SDD ▸ ${parts.join(' · ')} · /sdd`;
}
