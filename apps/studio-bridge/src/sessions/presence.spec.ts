import { defaultThreadOptions, type ThreadInfo } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import { PresenceTracker } from './presence';

const thread = (status: ThreadInfo['status']): ThreadInfo => ({
  id: 't1', channelId: 'spec:s1', title: 'x', agent: 'sdd-orchestrator', options: defaultThreadOptions(),
  status, createdAt: '', lastActivity: '',
});
const stateOf = (tracker: PresenceTracker, agent: string) => tracker.compute().find((p) => p.agent === agent);

describe('PresenceTracker', () => {
  const agents = () => ['sdd-orchestrator', 'sdd-planner', 'sdd-reviewer'];

  it('reports everyone idle at start', () => {
    expect(new PresenceTracker(agents).compute().every((p) => p.state === 'idle')).toBe(true);
  });

  it('tracks main agent, subagent, approval and turn end', () => {
    const p = new PresenceTracker(agents);
    p.onThread(thread('running'));
    expect(stateOf(p, 'sdd-orchestrator')).toMatchObject({ state: 'working', threadId: 't1', specId: 's1' });

    p.onEvent('t1', { type: 'subagent.start', agentId: 'a1', agentType: 'sdd-planner' });
    p.onEvent('t1', { type: 'tool.start', toolUseId: 'u', author: { agent: 'sdd-planner', parentToolUseId: 'x' }, tool: 'Read', summary: '' });
    expect(stateOf(p, 'sdd-planner')).toMatchObject({ state: 'working', tool: 'Read' });

    p.onThread(thread('waiting-approval'));
    p.onEvent('t1', { type: 'approval.requested', approvalId: 'p', author: { agent: 'sdd-planner', parentToolUseId: 'x' }, tool: 'Bash', summary: '' });
    expect(stateOf(p, 'sdd-planner')?.state).toBe('waiting');

    p.onEvent('t1', { type: 'approval.resolved', approvalId: 'p', decision: 'allow' });
    p.onEvent('t1', { type: 'subagent.stop', agentId: 'a1', agentType: 'sdd-planner' });
    p.onEvent('t1', { type: 'turn.end', usage: { model: 'm', effort: null, tokensIn: 0, tokensOut: 0, costUsd: 0 } });
    p.onThread(thread('idle'));
    expect(stateOf(p, 'sdd-orchestrator')?.state).toBe('open');
    expect(stateOf(p, 'sdd-planner')?.state).toBe('idle');
  });

  it('includes unknown subagent types that show up at runtime', () => {
    const p = new PresenceTracker(agents);
    p.onThread(thread('running'));
    p.onEvent('t1', { type: 'subagent.start', agentId: 'a2', agentType: 'Explore' });
    expect(stateOf(p, 'Explore')?.state).toBe('working');
  });

  it('keeps subagents alive after turn.end until thread status is idle/interrupted/error', () => {
    const p = new PresenceTracker(agents);
    p.onThread(thread('running'));
    p.onEvent('t1', { type: 'subagent.start', agentId: 'a1', agentType: 'sdd-planner' });
    p.onEvent('t1', { type: 'turn.end', usage: { model: 'm', effort: null, tokensIn: 0, tokensOut: 0, costUsd: 0 } });
    expect(stateOf(p, 'sdd-planner')?.state).toBe('working');

    p.onThread(thread('idle'));
    expect(stateOf(p, 'sdd-planner')?.state).toBe('idle');
  });

  it('tracks multiple approvals and keeps waiting until all resolved', () => {
    const p = new PresenceTracker(agents);
    p.onThread(thread('waiting-approval'));
    p.onEvent('t1', { type: 'approval.requested', approvalId: 'a1', author: { agent: 'sdd-planner', parentToolUseId: 'x' }, tool: 'Bash', summary: '' });
    p.onEvent('t1', { type: 'approval.requested', approvalId: 'a2', author: { agent: 'sdd-reviewer', parentToolUseId: 'y' }, tool: 'Edit', summary: '' });
    expect(stateOf(p, 'sdd-planner')?.state).toBe('waiting');
    expect(stateOf(p, 'sdd-reviewer')?.state).toBe('waiting');

    p.onEvent('t1', { type: 'approval.resolved', approvalId: 'a1', decision: 'allow' });
    expect(stateOf(p, 'sdd-planner')?.state).toBe('idle');
    expect(stateOf(p, 'sdd-reviewer')?.state).toBe('waiting');

    p.onEvent('t1', { type: 'approval.resolved', approvalId: 'a2', decision: 'deny' });
    expect(stateOf(p, 'sdd-reviewer')?.state).toBe('idle');
  });

  it('M2: turn.end clears tools but keeps pending approvals until resolved or the thread leaves running', () => {
    const p = new PresenceTracker(agents);
    p.onThread(thread('waiting-approval'));
    p.onEvent('t1', { type: 'tool.start', toolUseId: 'u', author: { agent: 'sdd-orchestrator', parentToolUseId: null }, tool: 'Read', summary: '' });
    p.onEvent('t1', { type: 'approval.requested', approvalId: 'p', author: { agent: 'sdd-orchestrator', parentToolUseId: null }, tool: 'Bash', summary: '' });
    p.onEvent('t1', { type: 'turn.end', usage: { model: 'm', effort: null, tokensIn: 1, tokensOut: 1, costUsd: 0 } });
    expect(stateOf(p, 'sdd-orchestrator')).toMatchObject({ state: 'waiting', tool: null });
    p.onEvent('t1', { type: 'approval.resolved', approvalId: 'p', decision: 'allow' });
    expect(stateOf(p, 'sdd-orchestrator')?.state).toBe('working');
  });
});
