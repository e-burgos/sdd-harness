import type { AlwaysOffer, AlwaysRule, AttachmentRef, Author, PromptRefs, SessionStatus, ThreadEvent, ThreadInfo, Usage } from '@sdd-studio/protocol';

export type TimelineItem =
  | {
      kind: 'user';
      id: string;
      seq: number;
      text: string;
      attachments?: AttachmentRef[];
      refs?: PromptRefs;
      pendingId?: string;
      delivery?: 'cut-point' | 'next-turn';
      notDelivered?: boolean;
    }
  | { kind: 'message'; id: string; seq: number; author: Author; text: string; done: boolean }
  | {
      kind: 'tool';
      id: string;
      seq: number;
      author: Author;
      tool: string;
      summary: string;
      summaryTruncated?: boolean;
      diff?: string;
      status: 'running' | 'ok' | 'error';
      result?: string;
    }
  | {
      kind: 'approval';
      id: string;
      seq: number;
      author: Author;
      tool: string;
      summary: string;
      diff?: string;
      input?: string;
      inputTruncated?: boolean;
      gateWarning?: string;
      always?: AlwaysOffer;
      remembered?: AlwaysRule;
      decision: 'pending' | 'allow' | 'deny';
      reason?: string;
    }
  | { kind: 'subagent'; id: string; seq: number; agentType: string; phase: 'start' | 'stop' }
  | { kind: 'usage'; id: string; seq: number; usage: Usage }
  | { kind: 'status'; id: string; seq: number; status: SessionStatus; error?: { code: string; message: string } };

export interface PendingItem {
  id: string;
  text: string;
  attachments?: AttachmentRef[];
  refs?: PromptRefs;
}

const withExtras = (e: { attachments?: AttachmentRef[]; refs?: PromptRefs }) => ({
  ...(e.attachments?.length ? { attachments: e.attachments } : {}),
  ...(e.refs ? { refs: e.refs } : {}),
});

export interface TouchedDocument {
  seq: number;
  path: string;
  op: 'created' | 'modified' | 'deleted';
  author: Author;
}

export interface ThreadState {
  info: ThreadInfo | null;
  pending: PendingItem[];
  items: TimelineItem[];
  touched: TouchedDocument[];
  lastSeq: number;
  /** false until history was applied; live events are buffered meanwhile */
  synced: boolean;
  buffer: { seq: number; event: ThreadEvent }[];
}

export const emptyThread = (): ThreadState => ({ info: null, pending: [], items: [], touched: [], lastSeq: -1, synced: false, buffer: [] });

function update<K extends TimelineItem['kind']>(
  items: TimelineItem[],
  kind: K,
  id: string,
  fn: (item: Extract<TimelineItem, { kind: K }>) => TimelineItem,
): TimelineItem[] {
  const index = items.findIndex((i) => i.kind === kind && i.id === id);
  if (index < 0) return items;
  const next = items.slice();
  next[index] = fn(items[index] as Extract<TimelineItem, { kind: K }>);
  return next;
}

export const isToolSummaryClipped = (tool: { summary: string; summaryTruncated?: boolean }): boolean =>
  tool.summaryTruncated ?? tool.summary.endsWith('…');

export function applyThreadEvent(thread: ThreadState, seq: number, event: ThreadEvent): ThreadState {
  if (seq <= thread.lastSeq) return thread;
  let items = thread.items;
  let info = thread.info;
  let pending = thread.pending;
  let touched = thread.touched;
  switch (event.type) {
    case 'user.message':
      items = [
        ...items,
        {
          kind: 'user',
          id: `u:${seq}`,
          seq,
          text: event.text,
          ...withExtras(event),
          ...(event.pendingId ? { pendingId: event.pendingId, delivery: event.delivery } : {}),
        },
      ];
      if (event.pendingId) pending = pending.filter((p) => p.id !== event.pendingId);
      break;
    case 'pending.added':
      if (!pending.some((p) => p.id === event.pendingId)) pending = [...pending, { id: event.pendingId, text: event.text, ...withExtras(event) }];
      break;
    case 'pending.edited':
      pending = pending.map((p) => (p.id === event.pendingId ? { ...p, text: event.text } : p));
      break;
    case 'pending.removed':
      pending = pending.filter((p) => p.id !== event.pendingId);
      break;
    case 'pending.reverted': {
      const delivered = [...items].reverse().find((i) => i.kind === 'user' && i.pendingId === event.pendingId && !i.notDelivered);
      if (delivered?.kind === 'user') {
        items = items.map((i) => (i === delivered ? { ...delivered, notDelivered: true } : i));
        if (!pending.some((p) => p.id === event.pendingId)) pending = [...pending, { id: event.pendingId, text: delivered.text, ...withExtras(delivered) }];
      }
      break;
    }
    case 'message.start':
      items = [...items, { kind: 'message', id: event.messageId, seq, author: event.author, text: '', done: false }];
      break;
    case 'message.delta':
      items = update(items, 'message', event.messageId, (m) => ({ ...m, text: m.text + event.text }));
      break;
    case 'message.end':
      items = update(items, 'message', event.messageId, (m) => ({ ...m, done: true }));
      break;
    case 'tool.start':
      items = [
        ...items,
        { kind: 'tool', id: event.toolUseId, seq, author: event.author, tool: event.tool, summary: event.summary, summaryTruncated: event.summaryTruncated, diff: event.diff, status: 'running' },
      ];
      break;
    case 'tool.end':
      items = update(items, 'tool', event.toolUseId, (t) => ({ ...t, status: event.isError ? 'error' : 'ok', result: event.summary }));
      break;
    case 'subagent.start':
    case 'subagent.stop':
      items = [
        ...items,
        { kind: 'subagent', id: `${event.agentId}:${seq}`, seq, agentType: event.agentType, phase: event.type === 'subagent.start' ? 'start' : 'stop' },
      ];
      break;
    case 'approval.requested':
      items = [
        ...items,
        {
          kind: 'approval',
          id: event.approvalId,
          seq,
          author: event.author,
          tool: event.tool,
          summary: event.summary,
          diff: event.diff,
          input: event.input,
          inputTruncated: event.inputTruncated,
          gateWarning: event.gateWarning,
          always: event.always,
          decision: 'pending',
        },
      ];
      break;
    case 'approval.resolved':
      items = update(items, 'approval', event.approvalId, (a) => ({ ...a, decision: event.decision, reason: event.reason, remembered: event.remembered }));
      break;
    case 'document.touched':
      touched = [...touched, { seq, path: event.path, op: event.op, author: event.author }];
      break;
    case 'turn.end':
      items = [...items, { kind: 'usage', id: `usage:${seq}`, seq, usage: event.usage }];
      break;
    case 'session.status':
      if (info) info = { ...info, status: event.status };
      if (event.status === 'error' || event.status === 'interrupted') {
        items = [...items, { kind: 'status', id: `status:${seq}`, seq, status: event.status, error: event.error }];
      }
      break;
  }
  return { ...thread, info, items, pending, touched, lastSeq: seq };
}
