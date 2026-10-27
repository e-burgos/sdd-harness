import type { BotEvent, CycleSummary, FixSummary, SessionStatus, SpecSummary, ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { pendingApprovals } from '@/lib/store/selectors';
import type { ThreadState } from '@/lib/store/timeline';

export const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

const BUSY: ReadonlySet<SessionStatus> = new Set(['queued', 'running', 'waiting-approval']);
const RUNNING: ReadonlySet<SessionStatus> = new Set(['queued', 'running']);
const OPEN_FIX: ReadonlySet<string> = new Set(['pending', 'in-progress']);
const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, alta: 1, medium: 2, media: 2, low: 3, baja: 3 };

export type HomeChannelKind = 'general' | 'specs' | 'fixes' | 'dm' | 'other';

export const homeChannelKind = (channelId: string): HomeChannelKind => {
  if (channelId === 'general' || channelId === 'fixes') return channelId;
  if (channelId.startsWith('spec:')) return 'specs';
  if (channelId.startsWith('dm:')) return 'dm';
  return 'other';
};

export const isSpecClosed = (spec: SpecSummary): boolean => spec.status === 'completed';

export const isSpecActive = (spec: SpecSummary, cycles: readonly CycleSummary[]): boolean =>
  spec.status === 'in-progress' || cycles.some((cycle) => cycle.specId === spec.id && cycle.status === 'in-progress');

const cycleNumber = (cycle: CycleSummary): number => Number(cycle.cycle.slice(6));

export function currentCycleOf(cycles: readonly CycleSummary[], specId: string): CycleSummary | null {
  const own = cycles.filter((cycle) => cycle.specId === specId);
  const running = own.find((cycle) => cycle.status === 'in-progress');
  if (running) return running;
  return own.reduce<CycleSummary | null>((best, cycle) => (best === null || cycleNumber(cycle) > cycleNumber(best) ? cycle : best), null);
}

export interface SpecRow {
  spec: SpecSummary;
  cycle: CycleSummary | null;
  active: boolean;
}

export function specRows(snapshot: WorkspaceSnapshot): SpecRow[] {
  const rows = snapshot.specs.map((spec) => ({ spec, cycle: currentCycleOf(snapshot.cycles, spec.id), active: isSpecActive(spec, snapshot.cycles) }));
  return [...rows.filter((row) => row.active), ...rows.filter((row) => !row.active)];
}

export interface Counter {
  key: string;
  count: number;
}

export function countBy<T>(items: readonly T[], keyOf: (item: T) => string): Counter[] {
  const counters = new Map<string, number>();
  for (const item of items) counters.set(keyOf(item), (counters.get(keyOf(item)) ?? 0) + 1);
  return [...counters].map(([key, count]) => ({ key, count }));
}

export const isFixOpen = (fix: FixSummary): boolean => OPEN_FIX.has(fix.status);

export const severityRank = (severity: string | null): number => (severity === null ? 4 : (SEVERITY_RANK[severity.toLowerCase()] ?? 4));

export const normalizeSeverity = (severity: string | null): string => (severity === null ? 'none' : severity.toLowerCase());

export function sortFixes(fixes: readonly FixSummary[]): FixSummary[] {
  return [...fixes].sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export const isBusy = (status: SessionStatus): boolean => BUSY.has(status);

export function needsApproval(state: ThreadState): boolean {
  if (!state.info) return false;
  if (state.info.status === 'waiting-approval') return true;
  if (!state.synced) return false;
  return pendingApprovals(state).length > 0 || state.items.some((item) => item.kind === 'question' && item.outcome === 'pending');
}

export function isThreadActive(state: ThreadState, now: number): boolean {
  const info = state.info;
  if (!info) return false;
  if (isBusy(info.status) || info.pendingCount > 0 || needsApproval(state)) return true;
  const last = Date.parse(info.lastActivity);
  return Number.isFinite(last) && now - last <= ACTIVE_WINDOW_MS;
}

export const byRecency = (a: ThreadInfo, b: ThreadInfo): number => b.lastActivity.localeCompare(a.lastActivity);

export function infosOf(threads: Record<string, ThreadState>): ThreadInfo[] {
  return Object.values(threads).flatMap((state) => (state.info ? [state.info] : []));
}

export function runningThreads(threads: Record<string, ThreadState>): ThreadInfo[] {
  return infosOf(threads).filter((info) => RUNNING.has(info.status)).sort(byRecency);
}

export function approvalThreads(threads: Record<string, ThreadState>): ThreadInfo[] {
  return Object.values(threads).flatMap((state) => (state.info && needsApproval(state) ? [state.info] : [])).sort(byRecency);
}

export const runningCycles = (snapshot: WorkspaceSnapshot | null): CycleSummary[] => snapshot?.cycles.filter((cycle) => cycle.status === 'in-progress') ?? [];

export function threadsOfChannel(threads: Record<string, ThreadState>, channelId: string): ThreadInfo[] {
  return infosOf(threads).filter((info) => info.channelId === channelId).sort(byRecency);
}

export function threadsOfSpecChannels(threads: Record<string, ThreadState>): ThreadInfo[] {
  return infosOf(threads).filter((info) => homeChannelKind(info.channelId) === 'specs').sort(byRecency);
}

export function visibleConversations(threads: Record<string, ThreadState>, filter: 'active' | 'all', now: number, keepId: string | null): ThreadInfo[] {
  const states = Object.values(threads).flatMap((state) => (state.info ? [state] : []));
  const shown = filter === 'all' ? states : states.filter((state) => isThreadActive(state, now) || state.info?.id === keepId);
  return shown.map((state) => state.info as ThreadInfo).sort(byRecency);
}

export function recentEvents(lists: readonly BotEvent[][], limit = 50): BotEvent[] {
  const all = lists.flat();
  const dated = all.filter((event) => event.at).sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  const undated = all.filter((event) => !event.at);
  return [...dated, ...undated.reverse()].slice(0, limit);
}
