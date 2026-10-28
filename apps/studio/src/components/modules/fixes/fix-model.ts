import type { BotEvent, FixSummary, ThreadInfo } from '@sdd-studio/protocol';
import { linkEntriesOf } from '@/lib/link-targets';
import { matchesQuery } from '@/lib/nav/search';
import { severityRank } from '@/lib/sdd-status';

export const FIX_STATUSES = ['in-progress', 'pending', 'implemented', 'validated', 'absorbed'] as const;
export type FixStatus = (typeof FIX_STATUSES)[number];

export const FIXES_CHANNEL = 'fixes';

export const isFixStatus = (status: string): status is FixStatus => (FIX_STATUSES as readonly string[]).includes(status);

const timeOf = (iso: string | null | undefined): number => {
  if (!iso) return Number.NEGATIVE_INFINITY;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
};

export function compareFixes(a: FixSummary, b: FixSummary): number {
  return severityRank(a.severity) - severityRank(b.severity) || timeOf(b.createdAt) - timeOf(a.createdAt) || b.id.localeCompare(a.id);
}

export interface FixGroup {
  status: string;
  fixes: FixSummary[];
}

const statusOrder = (status: string): number => {
  const index = (FIX_STATUSES as readonly string[]).indexOf(status);
  return index === -1 ? FIX_STATUSES.length : index;
};

export function groupFixesByStatus(fixes: readonly FixSummary[]): FixGroup[] {
  const byStatus = new Map<string, FixSummary[]>();
  for (const fix of fixes) byStatus.set(fix.status, [...(byStatus.get(fix.status) ?? []), fix]);
  return [...byStatus.entries()]
    .sort(([a], [b]) => statusOrder(a) - statusOrder(b) || a.localeCompare(b))
    .map(([status, list]) => ({ status, fixes: [...list].sort(compareFixes) }));
}

export function shortFixId(id: string): string {
  return /\d+(?:-\d+)?$/.exec(id)?.[0] ?? id;
}

export function documentOfFix(fix: FixSummary): { id: string; name: string; path: string; type: 'fix'; status: 'generated' } | null {
  if (!fix.document) return null;
  const name = fix.document.split('/').at(-1) ?? fix.document;
  return { id: fix.document, name, path: fix.document, type: 'fix', status: 'generated' };
}

export function threadsOfFix(fixId: string, threads: readonly ThreadInfo[]): ThreadInfo[] {
  return threads
    .filter((info) => linkEntriesOf(info).some((entry) => entry.kind === 'fix' && entry.fixId === fixId))
    .sort((a, b) => timeOf(b.lastActivity) - timeOf(a.lastActivity));
}

export type FixActivityItem =
  | { kind: 'event'; key: string; at: string | null; event: BotEvent }
  | { kind: 'thread'; key: string; at: string | null; thread: ThreadInfo };

export function activityOfFix(fixId: string, events: readonly BotEvent[], threads: readonly ThreadInfo[]): FixActivityItem[] {
  const fromEvents: FixActivityItem[] = events.flatMap((event, index) =>
    event.payload['fixId'] === fixId ? [{ kind: 'event' as const, key: `event:${index}`, at: event.at ?? null, event }] : [],
  );
  const fromThreads: FixActivityItem[] = threadsOfFix(fixId, threads).map((thread) => ({ kind: 'thread', key: `thread:${thread.id}`, at: thread.lastActivity || null, thread }));
  const dated = [...fromEvents, ...fromThreads].filter((item) => item.at !== null).sort((a, b) => timeOf(b.at) - timeOf(a.at));
  const undated = fromEvents.filter((item) => item.at === null).reverse();
  return [...dated, ...undated];
}

export function matchesFix(query: string, fix: FixSummary, labels: { status: string; severity: string }): boolean {
  return matchesQuery(query, fix.id, fix.title, fix.severity, fix.status, fix.specId, labels.status, labels.severity);
}
