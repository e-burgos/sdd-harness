import type { ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { applyServerEvent, initialState, loadHistory, setBotHistory, setThreads, startRun } from './state';

const info = (over: Partial<ThreadInfo> = {}): ThreadInfo => ({
  id: 't1', channelId: 'general', title: 'hola', agent: 'sdd-orchestrator',
  options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' },
  status: 'idle', createdAt: '2026-10-07T10:00:00Z', lastActivity: '2026-10-07T10:00:00Z', ...over,
});

describe('state reducers', () => {
  it('merges thread.updated into existing timelines', () => {
    let s = applyServerEvent(initialState(), { kind: 'thread.event', threadId: 't1', seq: 0, event: { type: 'user.message', text: 'hola' } });
    s = applyServerEvent(s, { kind: 'thread.updated', thread: info({ status: 'running' }) });
    expect(s.threads.t1?.info?.status).toBe('running');
    expect(s.threads.t1?.items).toHaveLength(1);
  });

  it('replays history without duplicating live events', () => {
    let s = applyServerEvent(initialState(), { kind: 'thread.event', threadId: 't1', seq: 1, event: { type: 'user.message', text: 'b' } });
    s = loadHistory(s, 't1', [
      { seq: 0, event: { type: 'user.message', text: 'a' } },
      { seq: 1, event: { type: 'user.message', text: 'b' } },
    ]);
    expect(s.threads.t1?.items.map((i) => (i.kind === 'user' ? i.text : ''))).toEqual(['b']);
  });

  it('resolves an approval answered in another tab', () => {
    const author = { agent: 'sdd-planner', parentToolUseId: null };
    let s = loadHistory(initialState(), 't1', [
      { seq: 0, event: { type: 'approval.requested', approvalId: 'p', author, tool: 'Bash', summary: '$ ls' } },
    ]);
    s = applyServerEvent(s, { kind: 'thread.event', threadId: 't1', seq: 1, event: { type: 'approval.resolved', approvalId: 'p', decision: 'allow' } });
    expect(s.threads.t1?.items[0]).toMatchObject({ decision: 'allow' });
  });

  it('keeps workspace snapshot, presence, bot events and command runs', () => {
    const snapshot = { project: 'p', profile: 'team', kitVersion: null, specs: [], cycles: [], fixes: [], agents: [], gateMode: 'block', pricing: null, stale: [] } satisfies WorkspaceSnapshot;
    let s = applyServerEvent(initialState(), { kind: 'workspace.changed', areas: ['specs'], snapshot });
    s = applyServerEvent(s, { kind: 'presence.changed', presence: [{ agent: 'a', state: 'working', threadId: 't1', specId: null, tool: 'Read' }] });
    s = setBotHistory(s, 'fixes', [{ channelId: 'fixes', botKind: 'fix.created', payload: { fixId: 'F1' } }]);
    s = applyServerEvent(s, { kind: 'bot.event', channelId: 'fixes', botKind: 'fix.status', payload: { fixId: 'F1' } });
    s = startRun(s, { runId: 'r', name: 'validate', args: [] });
    s = applyServerEvent(s, { kind: 'command.output', runId: 'r', stream: 'stdout', chunk: 'ok\n' });
    s = applyServerEvent(s, { kind: 'command.exit', runId: 'r', exitCode: 0 });
    expect(s.snapshot?.project).toBe('p');
    expect(s.presence[0]?.state).toBe('working');
    expect(s.bot.fixes?.map((e) => e.botKind)).toEqual(['fix.created', 'fix.status']);
    expect(s.runs.r).toEqual({ runId: 'r', name: 'validate', args: [], output: 'ok\n', exitCode: 0 });
  });

  it('setThreads upserts infos', () => {
    const s = setThreads(initialState(), [info(), info({ id: 't2' })]);
    expect(Object.keys(s.threads).sort()).toEqual(['t1', 't2']);
  });
});
