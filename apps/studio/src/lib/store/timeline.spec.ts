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
      info: { id: 't', channelId: 'general', title: 'x', agent: 'sdd-orchestrator', options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' }, status: 'idle', createdAt: 'a', lastActivity: 'a', link: { target: { kind: 'none' }, source: 'legacy' }, pendingCount: 0 },
    };
    expect(applyThreadEvent(base, 0, { type: 'session.status', status: 'running' }).info?.status).toBe('running');
  });

  describe('pending messages', () => {
    const pendingText = (t: ThreadState) => t.pending.map((p) => `${p.id}:${p.text}`);

    it('adds, edits and removes pending messages', () => {
      const t = run([
        [0, { type: 'pending.added', pendingId: 'p1', text: 'uno' }],
        [1, { type: 'pending.added', pendingId: 'p2', text: 'dos' }],
        [2, { type: 'pending.edited', pendingId: 'p1', text: 'uno!' }],
        [3, { type: 'pending.removed', pendingId: 'p2' }],
      ]);
      expect(pendingText(t)).toEqual(['p1:uno!']);
      expect(t.items).toEqual([]);
    });

    it('keeps several pendings in send order and delivers each one independently (CA-013.4)', () => {
      const t = run([
        [0, { type: 'pending.added', pendingId: 'p1', text: 'uno' }],
        [1, { type: 'pending.added', pendingId: 'p2', text: 'dos' }],
        [2, { type: 'pending.added', pendingId: 'p3', text: 'tres' }],
        [3, { type: 'user.message', text: 'uno', pendingId: 'p1', delivery: 'cut-point' }],
        [4, { type: 'user.message', text: 'dos', pendingId: 'p2', delivery: 'cut-point' }],
      ]);
      expect(pendingText(t)).toEqual(['p3:tres']);
      expect(t.items).toEqual([
        { kind: 'user', id: 'u:3', seq: 3, text: 'uno', pendingId: 'p1', delivery: 'cut-point' },
        { kind: 'user', id: 'u:4', seq: 4, text: 'dos', pendingId: 'p2', delivery: 'cut-point' },
      ]);
    });

    it('rebuilds the same state from a replayed history after a reload (CA-013.6)', () => {
      const events: [number, ThreadEvent][] = [
        [0, { type: 'pending.added', pendingId: 'p1', text: 'uno' }],
        [1, { type: 'pending.added', pendingId: 'p2', text: 'dos' }],
        [2, { type: 'user.message', text: 'uno', pendingId: 'p1', delivery: 'next-turn' }],
      ];
      const live = run(events);
      const replayed = events.reduce((t, [seq, e]) => applyThreadEvent(t, seq, e), emptyThread());
      expect(replayed).toEqual(live);
      expect(pendingText(replayed)).toEqual(['p2:dos']);
    });

    it('does not duplicate a pending message that is announced twice', () => {
      const t = run([
        [0, { type: 'pending.added', pendingId: 'p1', text: 'uno' }],
        [1, { type: 'pending.added', pendingId: 'p1', text: 'uno' }],
      ]);
      expect(t.pending).toHaveLength(1);
    });

    it('returns a reverted message to pending and flags the delivered copy as not reached (CA-015.2)', () => {
      const t = run([
        [0, { type: 'pending.added', pendingId: 'p1', text: 'uno' }],
        [1, { type: 'user.message', text: 'uno', pendingId: 'p1', delivery: 'cut-point' }],
        [2, { type: 'pending.reverted', pendingId: 'p1', reason: 'interrupt' }],
      ]);
      expect(pendingText(t)).toEqual(['p1:uno']);
      expect(t.items).toEqual([{ kind: 'user', id: 'u:1', seq: 1, text: 'uno', pendingId: 'p1', delivery: 'cut-point', notDelivered: true }]);
    });

    it('delivers again after a revert without flagging the new copy (CA-015.4)', () => {
      const t = run([
        [0, { type: 'pending.added', pendingId: 'p1', text: 'uno' }],
        [1, { type: 'user.message', text: 'uno', pendingId: 'p1', delivery: 'cut-point' }],
        [2, { type: 'pending.reverted', pendingId: 'p1', reason: 'interrupt' }],
        [3, { type: 'user.message', text: 'uno', pendingId: 'p1', delivery: 'next-turn' }],
      ]);
      expect(t.pending).toEqual([]);
      expect(t.items.map((i) => (i.kind === 'user' ? i.notDelivered ?? false : null))).toEqual([true, false]);
    });

    it('ignores a revert for a message it never saw delivered', () => {
      const t = run([[0, { type: 'pending.reverted', pendingId: 'zz', reason: 'interrupt' }]]);
      expect(t.pending).toEqual([]);
    });

    it('keeps a plain user message free of pending fields', () => {
      const t = run([[0, { type: 'user.message', text: 'hola' }]]);
      expect(Object.keys(t.items[0]!)).toEqual(['kind', 'id', 'seq', 'text']);
    });
  });

  it('carries the Always offer and the remembered rule through the approval lifecycle', () => {
    const requested = run([[0, { type: 'approval.requested', approvalId: 'p1', author: main, tool: 'Bash', summary: '$ git status', always: { kind: 'bash-prefix', prefix: 'git status' } }]]);
    expect(requested.items[0]).toMatchObject({ always: { kind: 'bash-prefix', prefix: 'git status' }, decision: 'pending' });
    const resolved = applyThreadEvent(requested, 1, { type: 'approval.resolved', approvalId: 'p1', decision: 'allow', remembered: { kind: 'bash-prefix', prefix: 'git status' } });
    expect(resolved.items[0]).toMatchObject({ decision: 'allow', remembered: { kind: 'bash-prefix', prefix: 'git status' } });
  });
});

describe('attachments and refs in the timeline', () => {
  const ref = { sha256: 'a'.repeat(64), kind: 'image' as const, mime: 'image/png' as const, name: 'a.png', size: 3, width: 2, height: 2 };
  const refs = { agents: ['sdd-planner'], skills: [] };

  it('carries attachments and refs on the user item and omits them when absent', () => {
    const t = run([
      [0, { type: 'user.message', text: 'mirá', attachments: [ref], refs }],
      [1, { type: 'user.message', text: 'plano', attachments: [] }],
    ]);
    expect(t.items[0]).toMatchObject({ attachments: [ref], refs });
    expect(t.items[1]).not.toHaveProperty('attachments');
  });

  it('carries attachments through pending.added, delivery and revert', () => {
    let t = run([[0, { type: 'pending.added', pendingId: 'p1', text: 'uno', attachments: [ref], refs }]]);
    expect(t.pending[0]).toEqual({ id: 'p1', text: 'uno', attachments: [ref], refs });
    t = applyThreadEvent(t, 1, { type: 'user.message', text: 'uno', attachments: [ref], refs, pendingId: 'p1', delivery: 'cut-point' });
    expect(t.pending).toEqual([]);
    t = applyThreadEvent(t, 2, { type: 'pending.reverted', pendingId: 'p1', reason: 'interrupt' });
    expect(t.pending[0]).toEqual({ id: 'p1', text: 'uno', attachments: [ref], refs });
  });
});

describe('document.touched', () => {
  it('records touched documents without entering the timeline items', () => {
    const t = run([
      [0, { type: 'user.message', text: 'hola' }],
      [1, { type: 'document.touched', path: 'sdd/specs/a/brief.yaml', op: 'created', author: main }],
    ]);
    expect(t.touched).toEqual([{ seq: 1, path: 'sdd/specs/a/brief.yaml', op: 'created', author: main }]);
    expect(t.items).toHaveLength(1);
    expect(t.lastSeq).toBe(1);
  });

  it('ignores a touched event whose seq is not newer than lastSeq', () => {
    const touch: ThreadEvent = { type: 'document.touched', path: 'sdd/x.md', op: 'modified', author: main };
    const t = run([[3, touch]]);
    expect(applyThreadEvent(t, 3, touch)).toBe(t);
    expect(applyThreadEvent(t, 2, touch).touched).toHaveLength(1);
  });

  it('carries summaryTruncated from tool.start to the tool item', () => {
    const t = run([[0, { type: 'tool.start', toolUseId: 't9', author: main, tool: 'Bash', summary: '$ cat sdd/…', summaryTruncated: true }]]);
    expect(t.items[0]).toMatchObject({ kind: 'tool', summaryTruncated: true });
  });
});
