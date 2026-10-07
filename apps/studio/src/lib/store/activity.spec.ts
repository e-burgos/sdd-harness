import type { ThreadInfo } from '@sdd-studio/protocol';
import { activityOf } from './activity';
import { emptyThread } from './timeline';

const info = (id: string, status: ThreadInfo['status']): ThreadInfo => ({
  id, channelId: 'general', title: id, agent: 'sdd-orchestrator',
  options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' },
  status, createdAt: 'a', lastActivity: 'a',
});

describe('activityOf', () => {
  it('lists busy threads with their agents, main agent first', () => {
    const threads = {
      a: { ...emptyThread(), info: info('a', 'running') },
      b: { ...emptyThread(), info: info('b', 'idle') },
    };
    const presence = [
      { agent: 'sdd-planner', state: 'working' as const, threadId: 'a', specId: null, tool: 'Read' },
      { agent: 'sdd-orchestrator', state: 'working' as const, threadId: 'a', specId: null, tool: null },
      { agent: 'sdd-reviewer', state: 'open' as const, threadId: 'b', specId: null, tool: null },
    ];
    expect(activityOf(threads, presence)).toEqual([
      {
        threadId: 'a', title: 'a', status: 'running',
        agents: [
          { agent: 'sdd-orchestrator', state: 'working', tool: null },
          { agent: 'sdd-planner', state: 'working', tool: 'Read' },
        ],
      },
    ]);
  });
});
