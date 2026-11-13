import { specIdOfChannel, type BotEvent, type SessionStatus, type ThreadInfo } from '@sdd-studio/protocol';
import { matchesQuery } from '@/lib/nav/search';
import { ACTIVITY_ORIGINS, type ActivityOrigin } from '@/lib/nav/use-nav';
import type { ThreadState } from '@/lib/store/timeline';

export const ACTIVITY_KINDS = ACTIVITY_ORIGINS;
export type ActivityKind = ActivityOrigin;

export type ActivityTarget =
  | { kind: 'thread'; threadId: string }
  | { kind: 'spec'; specId: string }
  | { kind: 'fix'; fixId: string }
  | { kind: 'tools' };

export type ActivityDetail =
  | { type: 'approval'; tool: string; summary: string; decision: 'pending' | 'allow' | 'deny'; threadTitle: string }
  | { type: 'question'; question: string; outcome: 'pending' | 'answered' | 'declined' | 'cancelled'; threadTitle: string }
  | { type: 'bot'; event: BotEvent }
  | { type: 'conversation'; phase: ConversationPhase; title: string; reference: string | null };

export type ConversationPhase = 'started' | 'idle' | 'interrupted' | 'error';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  at: string | null;
  approx: boolean;
  rank: number;
  target: ActivityTarget | null;
  detail: ActivityDetail;
}

export interface ActivityDay {
  key: string;
  at: string | null;
  entries: ActivityEntry[];
}

export const UNDATED_DAY = 'undated';

const SPEC_BOT_KINDS: ReadonlySet<string> = new Set(['spec.created', 'spec.status', 'cycle.opened', 'cycle.status']);
const FIX_BOT_KINDS: ReadonlySet<string> = new Set(['fix.created', 'fix.status']);

const endPhaseOf = (status: SessionStatus): ConversationPhase | null => (status === 'idle' || status === 'interrupted' || status === 'error' ? status : null);

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

export function kindOfBotEvent(event: BotEvent): ActivityKind | null {
  if (event.botKind === 'task.status') return event.payload['to'] === 'done' ? 'task' : null;
  if (SPEC_BOT_KINDS.has(event.botKind)) return 'spec';
  if (FIX_BOT_KINDS.has(event.botKind)) return 'fix';
  return event.botKind === 'tools.changed' || event.botKind === 'integration.changed' ? 'tools' : null;
}

function targetOfBotEvent(kind: ActivityKind, event: BotEvent): ActivityTarget | null {
  if (kind === 'tools') return { kind: 'tools' };
  if (kind === 'fix') {
    const fixId = text(event.payload['fixId']);
    return fixId ? { kind: 'fix', fixId } : null;
  }
  const specId = text(event.payload['specId']) ?? specIdOfChannel(event.channelId);
  return specId ? { kind: 'spec', specId } : null;
}

function botEntries(bot: Record<string, readonly BotEvent[]>): ActivityEntry[] {
  return Object.entries(bot).flatMap(([channelId, events]) =>
    events.flatMap((event, index) => {
      const kind = kindOfBotEvent(event);
      if (kind === null) return [];
      const entry: ActivityEntry = {
        id: `bot:${channelId}:${index}`,
        kind,
        at: event.at ?? null,
        approx: false,
        rank: index,
        target: targetOfBotEvent(kind, event),
        detail: { type: 'bot', event },
      };
      return [entry];
    }),
  );
}

function threadEntries(threads: Record<string, ThreadState>): ActivityEntry[] {
  return Object.values(threads).flatMap((state) => {
    const info = state.info;
    if (!info) return [];
    return state.items.flatMap((item): ActivityEntry[] => {
      const base = { at: info.lastActivity || null, approx: true, rank: item.seq, target: { kind: 'thread', threadId: info.id } as const };
      if (item.kind === 'approval') {
        return [{ ...base, id: `thread:${info.id}:${item.id}`, kind: 'approval', detail: { type: 'approval', tool: item.tool, summary: item.summary, decision: item.decision, threadTitle: info.title } }];
      }
      if (item.kind === 'question') {
        return [{ ...base, id: `thread:${info.id}:${item.id}`, kind: 'question', detail: { type: 'question', question: item.questions[0]?.question ?? '', outcome: item.outcome, threadTitle: info.title } }];
      }
      return [];
    });
  });
}

function conversationLink(info: ThreadInfo): { target: ActivityTarget; reference: string } | null {
  const target = info.link.target;
  if (target.kind === 'cycle') return { target: { kind: 'spec', specId: target.specId }, reference: target.specId };
  if (target.kind === 'fix') return { target: { kind: 'fix', fixId: target.fixId }, reference: target.fixId };
  return null;
}

function conversationEntries(threads: Record<string, ThreadState>): ActivityEntry[] {
  return Object.values(threads).flatMap((state) => {
    const info = state.info;
    if (!info) return [];
    const link = conversationLink(info);
    const entry = (phase: ConversationPhase, at: string, rank: number): ActivityEntry => ({
      id: `conversation:${info.id}:${phase === 'started' ? 'started' : 'ended'}`,
      kind: 'conversation',
      at: at || null,
      approx: false,
      rank,
      target: link?.target ?? { kind: 'thread', threadId: info.id },
      detail: { type: 'conversation', phase, title: info.title, reference: link?.reference ?? null },
    });
    const endPhase = info.lastActivity !== info.createdAt ? endPhaseOf(info.status) : null;
    return [entry('started', info.createdAt, 0), ...(endPhase ? [entry(endPhase, info.lastActivity, 1)] : [])];
  });
}

const timeOf = (at: string | null): number | null => {
  if (at === null) return null;
  const time = Date.parse(at);
  return Number.isFinite(time) ? time : null;
};

export function compareEntries(a: ActivityEntry, b: ActivityEntry): number {
  const ta = timeOf(a.at);
  const tb = timeOf(b.at);
  if (ta !== null && tb !== null) return tb - ta || b.rank - a.rank;
  if (ta !== null) return -1;
  if (tb !== null) return 1;
  return b.rank - a.rank;
}

export function buildActivity(bot: Record<string, readonly BotEvent[]>, threads: Record<string, ThreadState>): ActivityEntry[] {
  return [...botEntries(bot), ...threadEntries(threads), ...conversationEntries(threads)].sort(compareEntries);
}

export function countByKind(entries: readonly ActivityEntry[]): Record<ActivityKind, number> {
  const counts = Object.fromEntries(ACTIVITY_KINDS.map((kind) => [kind, 0])) as Record<ActivityKind, number>;
  for (const entry of entries) counts[entry.kind] += 1;
  return counts;
}

export function filterByKinds(entries: readonly ActivityEntry[], selected: readonly ActivityKind[]): ActivityEntry[] {
  return selected.length === 0 ? [...entries] : entries.filter((entry) => selected.includes(entry.kind));
}

export function filterByQuery(entries: readonly ActivityEntry[], query: string, searchable: (entry: ActivityEntry) => string): ActivityEntry[] {
  return entries.filter((entry) => matchesQuery(query, searchable(entry)));
}

export function dayKeyOf(at: string | null): string {
  const time = timeOf(at);
  if (time === null) return UNDATED_DAY;
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function groupByDay(entries: readonly ActivityEntry[]): ActivityDay[] {
  const days: ActivityDay[] = [];
  for (const entry of entries) {
    const key = dayKeyOf(entry.at);
    const last = days[days.length - 1];
    if (last && last.key === key) last.entries.push(entry);
    else days.push({ key, at: key === UNDATED_DAY ? null : entry.at, entries: [entry] });
  }
  return days;
}

export function toggleKind(selected: readonly ActivityKind[], kind: ActivityKind): ActivityKind[] {
  return selected.includes(kind) ? selected.filter((item) => item !== kind) : ACTIVITY_KINDS.filter((item) => item === kind || selected.includes(item));
}
