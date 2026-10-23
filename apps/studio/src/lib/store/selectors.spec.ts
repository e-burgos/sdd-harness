import type { WorkspaceSnapshot } from '@sdd-studio/protocol';
import { initialState, setThreads } from './state';
import { activeThreads, channelsOf, cycleForChannel, dmChannelsOf, groupTimeline, pendingApprovals, threadsInChannel } from './selectors';
import { applyThreadEvent, emptyThread } from './timeline';

const snapshot: WorkspaceSnapshot = {
  project: 'p', profile: 'team', kitVersion: '0.16.0', gateMode: 'block', pricing: null, stale: [], fixes: [],
  agents: [
    { id: 'sdd-orchestrator', description: '', model: 'opus', source: 'sdd', path: 'sdd/agents/sdd-orchestrator.agent.md' },
    { id: 'sdd-planner', description: '', model: 'sonnet', source: 'sdd', path: 'sdd/agents/sdd-planner.agent.md' },
  ],
  skills: [],
  specs: [
    { id: 's2', title: 'Dos', status: 'completed', folder: 'sdd/specs/s2', module: null, app: null, dependsOn: [] },
    { id: 's1', title: 'Uno', status: 'in-progress', folder: 'sdd/specs/s1', module: null, app: null, dependsOn: [] },
  ],
  cycles: [
    { specId: 's1', cycle: 'cycle-01', status: 'completed', flow: 'full', apps: [], tasks: [], tasksTotal: 1, tasksDone: 1 },
    { specId: 's1', cycle: 'cycle-02', status: 'in-progress', flow: 'full', apps: [], tasks: [], tasksTotal: 3, tasksDone: 1 },
  ],
};

describe('selectors', () => {
  it('lists general, active specs first, then closed specs and fixes', () => {
    expect(channelsOf(snapshot).map((c) => c.id)).toEqual(['general', 'spec:s1', 'spec:s2', 'fixes']);
    expect(channelsOf(null).map((c) => c.id)).toEqual(['general', 'fixes']);
  });
  it('lists DM channels for the workspace agents', () => {
    expect(dmChannelsOf(snapshot).map((c) => c.id)).toEqual(['dm:sdd-orchestrator', 'dm:sdd-planner']);
  });
  it('picks the in-progress cycle, else the last one', () => {
    expect(cycleForChannel(snapshot, 'spec:s1')?.cycle).toBe('cycle-02');
    expect(cycleForChannel(snapshot, 'general')).toBeNull();
  });
  it('sorts threads in a channel by last activity', () => {
    const base = { agent: 'a', options: { agent: 'a', model: 'kit' as const, effort: null, permissionMode: 'default' as const }, status: 'idle' as const, title: 'x', createdAt: '1', link: { target: { kind: 'none' as const }, source: 'legacy' as const }, pendingCount: 0 };
    const s = setThreads(initialState(), [
      { ...base, id: 'old', channelId: 'general', lastActivity: '2026-01-01' },
      { ...base, id: 'new', channelId: 'general', lastActivity: '2026-02-01' },
      { ...base, id: 'other', channelId: 'fixes', lastActivity: '2026-03-01' },
    ]);
    expect(threadsInChannel(s.threads, 'general').map((t) => t.id)).toEqual(['new', 'old']);
  });
  it('groups consecutive tools of the same author and finds pending approvals', () => {
    const a = { agent: 'x', parentToolUseId: null };
    const b = { agent: 'y', parentToolUseId: 'p' };
    let t = emptyThread();
    t = applyThreadEvent(t, 0, { type: 'tool.start', toolUseId: '1', author: a, tool: 'Read', summary: 'r' });
    t = applyThreadEvent(t, 1, { type: 'tool.start', toolUseId: '2', author: a, tool: 'Grep', summary: 'g' });
    t = applyThreadEvent(t, 2, { type: 'tool.start', toolUseId: '3', author: b, tool: 'Read', summary: 'r' });
    t = applyThreadEvent(t, 3, { type: 'approval.requested', approvalId: 'p1', author: b, tool: 'Bash', summary: '$ x' });
    const blocks = groupTimeline(t.items);
    expect(blocks.map((bl) => (bl.kind === 'tools' ? `tools:${bl.items.length}` : bl.item.kind))).toEqual(['tools:2', 'tools:1', 'approval']);
    expect(pendingApprovals(t).map((p) => p.id)).toEqual(['p1']);
  });
  it('orders active threads by waiting-approval, running, queued and then recency, excluding the rest', () => {
    const base = { agent: 'a', options: { agent: 'a', model: 'kit' as const, effort: null, permissionMode: 'default' as const }, title: 'x', createdAt: '1', channelId: 'general', link: { target: { kind: 'none' as const }, source: 'legacy' as const }, pendingCount: 0 };
    const s = setThreads(initialState(), [
      { ...base, id: 'q', status: 'queued', lastActivity: '2026-05-01' },
      { ...base, id: 'r-old', status: 'running', lastActivity: '2026-01-01' },
      { ...base, id: 'r-new', status: 'running', lastActivity: '2026-02-01' },
      { ...base, id: 'w', status: 'waiting-approval', lastActivity: '2026-01-01' },
      { ...base, id: 'i', status: 'idle', lastActivity: '2026-06-01' },
      { ...base, id: 'e', status: 'error', lastActivity: '2026-06-01' },
      { ...base, id: 'x', status: 'interrupted', lastActivity: '2026-06-01' },
    ]);
    expect(activeThreads(s.threads).map((t) => t.id)).toEqual(['w', 'r-new', 'r-old', 'q']);
    expect(activeThreads({})).toEqual([]);
  });
});
