import type { SessionStatus, ThreadInfo } from '@sdd-studio/protocol';
import { linkEntriesOf, linkRefLabel, toLinkRef } from '@/lib/link-targets';

export const MAP_FILTERS = ['all', 'transversal', 'cycle', 'running', 'ready'] as const;
export type MapFilter = (typeof MAP_FILTERS)[number];

const IN_PROGRESS = new Set<SessionStatus>(['running', 'queued', 'waiting-approval']);

const isTransversal = (info: ThreadInfo): boolean => !linkEntriesOf(info).some((entry) => entry.kind === 'cycle' || entry.kind === 'fix');
const isByCycle = (info: ThreadInfo): boolean => linkEntriesOf(info).some((entry) => entry.kind === 'cycle');
const isRunning = (info: ThreadInfo): boolean => IN_PROGRESS.has(info.status);
const isReady = (info: ThreadInfo): boolean => info.status === 'idle';

const PREDICATES: Record<MapFilter, (info: ThreadInfo) => boolean> = {
  all: () => true,
  transversal: isTransversal,
  cycle: isByCycle,
  running: isRunning,
  ready: isReady,
};

export const filterConversations = (conversations: readonly ThreadInfo[], filter: MapFilter): ThreadInfo[] => conversations.filter(PREDICATES[filter]);

export function countByFilter(conversations: readonly ThreadInfo[]): Record<MapFilter, number> {
  return Object.fromEntries(MAP_FILTERS.map((filter) => [filter, filterConversations(conversations, filter).length])) as Record<MapFilter, number>;
}

export const associationLabels = (info: ThreadInfo): string[] => linkEntriesOf(info).map((entry) => linkRefLabel(toLinkRef(entry)));

export interface CycleGroup {
  key: string | null;
  label: string | null;
  items: ThreadInfo[];
}

export function groupByCycle(conversations: readonly ThreadInfo[]): CycleGroup[] {
  const groups = new Map<string | null, CycleGroup>();
  for (const info of conversations) {
    const entry = linkEntriesOf(info).find((candidate) => candidate.kind === 'cycle');
    const key = entry && entry.kind === 'cycle' ? `${entry.specId}/${entry.cycle}` : null;
    const group = groups.get(key) ?? { key, label: key, items: [] };
    group.items.push(info);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (a.key === null ? 1 : b.key === null ? -1 : a.key.localeCompare(b.key)));
}
