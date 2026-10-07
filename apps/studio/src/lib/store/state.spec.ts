import type { ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { applyServerEvent, beginSync, initialState, loadHistory, setBotHistory, setThreads, startRun } from './state';

const info = (over: Partial<ThreadInfo> = {}): ThreadInfo => ({
  id: 't1', channelId: 'general', title: 'hola', agent: 'sdd-orchestrator',
  options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' },
  status: 'idle', createdAt: '2026-10-07T10:00:00Z', lastActivity: '2026-10-07T10:00:00Z', ...over,
});

describe('state reducers', () => {
  it('merges thread.updated into existing timelines', () => {
    let s = loadHistory(initialState(), 't1', [{ seq: 0, event: { type: 'user.message', text: 'hola' } }]);
    s = applyServerEvent(s, { kind: 'thread.updated', thread: info({ status: 'running' }) });
    expect(s.threads.t1?.info?.status).toBe('running');
    expect(s.threads.t1?.items).toHaveLength(1);
  });

  const userText = (s: ReturnType<typeof initialState>) =>
    s.threads.t1?.items.map((i) => (i.kind === 'user' ? i.text : '')) ?? [];

  it('replays history without losing or duplicating a live event that arrived first', () => {
    let s = applyServerEvent(initialState(), { kind: 'thread.event', threadId: 't1', seq: 1, event: { type: 'user.message', text: 'b' } });
    expect(s.threads.t1?.items).toHaveLength(0);
    s = loadHistory(s, 't1', [
      { seq: 0, event: { type: 'user.message', text: 'a' } },
      { seq: 1, event: { type: 'user.message', text: 'b' } },
    ]);
    expect(userText(s)).toEqual(['a', 'b']);
    expect(s.threads.t1?.synced).toBe(true);
    expect(s.threads.t1?.buffer).toEqual([]);
  });

  it('buffers live events of an unknown thread until history is loaded', () => {
    let s = applyServerEvent(initialState(), { kind: 'thread.event', threadId: 't1', seq: 0, event: { type: 'user.message', text: 'a' } });
    s = applyServerEvent(s, { kind: 'thread.updated', thread: info() });
    expect(s.threads.t1?.info?.id).toBe('t1');
    expect(s.threads.t1?.items).toHaveLength(0);
    s = loadHistory(s, 't1', []);
    expect(userText(s)).toEqual(['a']);
  });

  it('beginSync buffers live events until the gap history arrives', () => {
    let s = loadHistory(initialState(), 't1', [{ seq: 0, event: { type: 'user.message', text: 'a' } }]);
    s = beginSync(s, 't1');
    s = applyServerEvent(s, { kind: 'thread.event', threadId: 't1', seq: 2, event: { type: 'user.message', text: 'c' } });
    expect(userText(s)).toEqual(['a']);
    s = loadHistory(s, 't1', [{ seq: 1, event: { type: 'user.message', text: 'b' } }]);
    expect(userText(s)).toEqual(['a', 'b', 'c']);
  });

  it('caps the live buffer at 1000 events, dropping the oldest', () => {
    let s = initialState();
    for (let seq = 0; seq < 1005; seq++) {
      s = applyServerEvent(s, { kind: 'thread.event', threadId: 't1', seq, event: { type: 'user.message', text: String(seq) } });
    }
    const buffer = s.threads.t1?.buffer ?? [];
    expect(buffer).toHaveLength(1000);
    expect(buffer[0]?.seq).toBe(5);
  });

  it('keeps identities when incoming thread info is equal', () => {
    const s = setThreads(initialState(), [info()]);
    expect(setThreads(s, [info()])).toBe(s);
    expect(applyServerEvent(s, { kind: 'thread.updated', thread: info() })).toBe(s);
    expect(applyServerEvent(s, { kind: 'thread.updated', thread: info({ status: 'running' }) })).not.toBe(s);
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
