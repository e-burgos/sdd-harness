import type { ThreadEvent } from '@sdd-studio/protocol';
import { applyThreadEvent, emptyThread, type ThreadState } from './timeline';

const main = { agent: 'sdd-orchestrator', parentToolUseId: null };
const planner = { agent: 'sdd-planner', parentToolUseId: 't0' };
const run = (events: [number, ThreadEvent][]): ThreadState => events.reduce((t, [seq, e]) => applyThreadEvent(t, seq, e), emptyThread());

describe('applyThreadEvent', () => {
  it('assembles streamed messages', () => {
    const t = run([
      [0, { type: 'user.message', text: 'hola' }],
      [1, { type: 'message.start', messageId: 'm1', author: main }],
      [2, { type: 'message.delta', messageId: 'm1', text: 'Hola ' }],
      [3, { type: 'message.delta', messageId: 'm1', text: 'mundo' }],
      [4, { type: 'message.end', messageId: 'm1' }],
    ]);
    expect(t.items).toEqual([
      { kind: 'user', id: 'u:0', seq: 0, text: 'hola' },
      { kind: 'message', id: 'm1', seq: 1, author: main, text: 'Hola mundo', done: true },
    ]);
    expect(t.lastSeq).toBe(4);
  });

  it('ignores replayed sequence numbers', () => {
    const once = run([[0, { type: 'user.message', text: 'hola' }]]);
    expect(applyThreadEvent(once, 0, { type: 'user.message', text: 'hola' })).toBe(once);
  });

  it('tracks tools, approvals, subagents, usage and error status', () => {
    const t = run([
      [0, { type: 'subagent.start', agentId: 'a1', agentType: 'sdd-planner' }],
      [1, { type: 'tool.start', toolUseId: 't1', author: planner, tool: 'Bash', summary: '$ ls' }],
      [2, { type: 'tool.end', toolUseId: 't1', isError: false, summary: 'a\nb' }],
      [3, { type: 'approval.requested', approvalId: 'p1', author: planner, tool: 'Write', summary: 'x.ts', diff: '+x', input: '{"file_path":"x.ts"}', gateWarning: 'w' }],
      [4, { type: 'approval.resolved', approvalId: 'p1', decision: 'deny', reason: 'no' }],
      [5, { type: 'turn.end', usage: { model: 'm', effort: null, tokensIn: 1, tokensOut: 2, costUsd: 0.01 } }],
      [6, { type: 'session.status', status: 'error', error: { code: 'x', message: 'boom' } }],
      [7, { type: 'session.status', status: 'idle' }],
    ]);
    expect(t.items.map((i) => i.kind)).toEqual(['subagent', 'tool', 'approval', 'usage', 'status']);
    expect(t.items[1]).toMatchObject({ status: 'ok', result: 'a\nb' });
    expect(t.items[2]).toMatchObject({ decision: 'deny', reason: 'no', input: '{"file_path":"x.ts"}', gateWarning: 'w' });
    expect(t.items[4]).toMatchObject({ kind: 'status', status: 'error', error: { message: 'boom' } });
  });

  it('updates info.status on session.status when info is known', () => {
    const base: ThreadState = {
      ...emptyThread(),
      info: { id: 't', channelId: 'general', title: 'x', agent: 'sdd-orchestrator', options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' }, status: 'idle', createdAt: 'a', lastActivity: 'a' },
    };
    expect(applyThreadEvent(base, 0, { type: 'session.status', status: 'running' }).info?.status).toBe('running');
  });
});
