import { describe, expect, it } from 'vitest';
import { ServerEvent, ThreadEvent } from './index';

const author = { agent: 'sdd-planner', parentToolUseId: 'toolu_1' };

describe('ThreadEvent', () => {
  it('parses every event type', () => {
    const events = [
      { type: 'user.message', text: 'hola' },
      { type: 'message.start', messageId: 'm1', author },
      { type: 'message.delta', messageId: 'm1', text: 'x' },
      { type: 'message.end', messageId: 'm1' },
      { type: 'tool.start', toolUseId: 't1', author, tool: 'Edit', summary: 'a.ts', diff: '-a\n+b' },
      { type: 'tool.end', toolUseId: 't1', isError: false, summary: 'ok' },
      { type: 'subagent.start', agentId: 'a1', agentType: 'sdd-planner' },
      { type: 'subagent.stop', agentId: 'a1', agentType: 'sdd-planner' },
      { type: 'approval.requested', approvalId: 'p1', author, tool: 'Bash', summary: '$ ls', gateWarning: 'w' },
      { type: 'approval.resolved', approvalId: 'p1', decision: 'deny', reason: 'no' },
      { type: 'turn.end', usage: { model: 'claude-haiku', effort: null, tokensIn: 1, tokensOut: 2, costUsd: 0.01 } },
      { type: 'session.status', status: 'error', error: { code: 'x', message: 'y' } },
    ];
    for (const e of events) expect(ThreadEvent.parse(e)).toEqual(e);
  });
  it('rejects unknown types and negative tokens', () => {
    expect(ThreadEvent.safeParse({ type: 'nope' }).success).toBe(false);
    const bad = { type: 'turn.end', usage: { model: 'm', effort: null, tokensIn: -1, tokensOut: 0, costUsd: 0 } };
    expect(ThreadEvent.safeParse(bad).success).toBe(false);
  });
});

describe('ServerEvent', () => {
  it('parses bot.event and command.exit', () => {
    const bot = { kind: 'bot.event', channelId: 'fixes', botKind: 'fix.created', payload: { fixId: 'F1' } };
    expect(ServerEvent.parse(bot)).toEqual(bot);
    expect(ServerEvent.parse({ kind: 'command.exit', runId: 'r', exitCode: 1 })).toEqual({
      kind: 'command.exit', runId: 'r', exitCode: 1,
    });
  });
});
