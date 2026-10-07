import { channelForDm, channelForSpec, specIdOfChannel, type Author, type CycleSummary, type ThreadInfo, type WorkspaceSnapshot } from '@sdd-studio/protocol';
import type { ThreadState, TimelineItem } from './timeline';

export interface ChannelEntry {
  id: string;
  kind: 'general' | 'fixes' | 'spec' | 'dm';
  label: string;
  status?: string;
}

const CLOSED = new Set(['completed', 'cancelled', 'archived']);

export function channelsOf(snapshot: WorkspaceSnapshot | null): ChannelEntry[] {
  const specs = [...(snapshot?.specs ?? [])].sort((a, b) => Number(CLOSED.has(a.status)) - Number(CLOSED.has(b.status)) || a.id.localeCompare(b.id));
  return [
    { id: 'general', kind: 'general', label: 'general' },
    ...specs.map((s): ChannelEntry => ({ id: channelForSpec(s.id), kind: 'spec', label: s.id, status: s.status })),
    { id: 'fixes', kind: 'fixes', label: 'fixes' },
  ];
}

export function dmChannelsOf(snapshot: WorkspaceSnapshot | null): ChannelEntry[] {
  return (snapshot?.agents ?? []).map((a) => ({ id: channelForDm(a.id), kind: 'dm', label: a.id }));
}

export function threadsInChannel(threads: Record<string, ThreadState>, channelId: string): ThreadInfo[] {
  return Object.values(threads)
    .flatMap((t) => (t.info && t.info.channelId === channelId ? [t.info] : []))
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

export function pendingApprovals(t: ThreadState): Extract<TimelineItem, { kind: 'approval' }>[] {
  return t.items.filter((i): i is Extract<TimelineItem, { kind: 'approval' }> => i.kind === 'approval' && i.decision === 'pending');
}

export function cycleForChannel(snapshot: WorkspaceSnapshot | null, channelId: string): CycleSummary | null {
  const specId = specIdOfChannel(channelId);
  if (!snapshot || !specId) return null;
  const cycles = snapshot.cycles.filter((c) => c.specId === specId);
  return cycles.find((c) => c.status === 'in-progress') ?? cycles.at(-1) ?? null;
}

export type TimelineBlock =
  | { kind: 'item'; item: TimelineItem }
  | { kind: 'tools'; id: string; author: Author; items: Extract<TimelineItem, { kind: 'tool' }>[] };

export function groupTimeline(items: TimelineItem[]): TimelineBlock[] {
  const blocks: TimelineBlock[] = [];
  for (const item of items) {
    const last = blocks.at(-1);
    if (item.kind === 'tool') {
      if (last?.kind === 'tools' && last.author.agent === item.author.agent) last.items.push(item);
      else blocks.push({ kind: 'tools', id: `tools:${item.id}`, author: item.author, items: [item] });
    } else {
      blocks.push({ kind: 'item', item });
    }
  }
  return blocks;
}
