import type { BotEvent, CycleSummary, FixSummary, SessionStatus, SpecSummary, ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { currentCycleOf, isFixOpen, isSpecActive, severityRank } from '@/lib/sdd-status';
import { pendingApprovals } from '@/lib/store/selectors';
import type { ThreadState } from '@/lib/store/timeline';

export const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

const BUSY: ReadonlySet<SessionStatus> = new Set(['queued', 'running', 'waiting-approval']);
const RUNNING: ReadonlySet<SessionStatus> = new Set(['queued', 'running']);

export type HomeChannelKind = 'general' | 'specs' | 'fixes' | 'dm' | 'other';

export const homeChannelKind = (channelId: string): HomeChannelKind => {
  if (channelId === 'general' || channelId === 'fixes') return channelId;
  if (channelId.startsWith('spec:')) return 'specs';
  if (channelId.startsWith('dm:')) return 'dm';
  return 'other';
};

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

export const severityBucketOf = (severity: string | null): string => (severity === null ? 'none' : severity.toLowerCase());

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
