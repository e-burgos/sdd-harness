import type { Author, SessionStatus, ThreadEvent, ThreadInfo, Usage } from '@sdd-studio/protocol';

export type TimelineItem =
  | { kind: 'user'; id: string; seq: number; text: string }
  | { kind: 'message'; id: string; seq: number; author: Author; text: string; done: boolean }
  | {
      kind: 'tool';
      id: string;
      seq: number;
      author: Author;
      tool: string;
      summary: string;
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
      decision: 'pending' | 'allow' | 'deny';
      reason?: string;
    }
  | { kind: 'subagent'; id: string; seq: number; agentType: string; phase: 'start' | 'stop' }
  | { kind: 'usage'; id: string; seq: number; usage: Usage }
  | { kind: 'status'; id: string; seq: number; status: SessionStatus; error?: { code: string; message: string } };

export interface ThreadState {
  info: ThreadInfo | null;
  items: TimelineItem[];
  lastSeq: number;
  /** false until history was applied; live events are buffered meanwhile */
  synced: boolean;
  buffer: { seq: number; event: ThreadEvent }[];
}

export const emptyThread = (): ThreadState => ({ info: null, items: [], lastSeq: -1, synced: false, buffer: [] });

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

export function applyThreadEvent(thread: ThreadState, seq: number, event: ThreadEvent): ThreadState {
  if (seq <= thread.lastSeq) return thread;
  let items = thread.items;
  let info = thread.info;
  switch (event.type) {
    case 'user.message':
      items = [...items, { kind: 'user', id: `u:${seq}`, seq, text: event.text }];
      break;
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
        { kind: 'tool', id: event.toolUseId, seq, author: event.author, tool: event.tool, summary: event.summary, diff: event.diff, status: 'running' },
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
          decision: 'pending',
        },
      ];
      break;
    case 'approval.resolved':
      items = update(items, 'approval', event.approvalId, (a) => ({ ...a, decision: event.decision, reason: event.reason }));
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
  return { ...thread, info, items, lastSeq: seq };
}
