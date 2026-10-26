import { describe, expect, it } from 'vitest';
import { ServerEvent, ThreadEvent, decodeServerMessage } from './index';

const author = { agent: 'sdd-planner', parentToolUseId: 'toolu_1' };

describe('ThreadEvent', () => {
  it('parses every event type', () => {
    const events = [
      { type: 'user.message', text: 'hola' },
      { type: 'message.start', messageId: 'm1', author },
      { type: 'message.delta', messageId: 'm1', text: 'x' },
      { type: 'message.end', messageId: 'm1' },
      { type: 'tool.start', toolUseId: 't1', author, tool: 'Edit', summary: 'a.ts', diff: '-a\n+b' },
      { type: 'tool.start', toolUseId: 't2', author, tool: 'Bash', summary: '$ ls …', summaryTruncated: true },
      { type: 'document.touched', path: 'sdd/specs/spec-a/brief.yaml', op: 'created', author },
      { type: 'tool.end', toolUseId: 't1', isError: false, summary: 'ok' },
      { type: 'subagent.start', agentId: 'a1', agentType: 'sdd-planner' },
      { type: 'subagent.stop', agentId: 'a1', agentType: 'sdd-planner' },
      { type: 'approval.requested', approvalId: 'p1', author, tool: 'Bash', summary: '$ ls', gateWarning: 'w' },
      { type: 'approval.requested', approvalId: 'p2', author, tool: 'Bash', summary: '$ ls', input: '{"command":"ls"}', inputTruncated: true },
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

describe('document.touched', () => {
  const touched = { type: 'document.touched', path: 'sdd/a.md', op: 'modified', author };

  it('accepts each operation', () => {
    for (const op of ['created', 'modified', 'deleted']) {
      expect(ThreadEvent.parse({ ...touched, op })).toEqual({ ...touched, op });
    }
  });

  it('bounds the path between 1 and 1024 characters', () => {
    expect(ThreadEvent.safeParse({ ...touched, path: '' }).success).toBe(false);
    expect(ThreadEvent.safeParse({ ...touched, path: 'a'.repeat(1024) }).success).toBe(true);
    expect(ThreadEvent.safeParse({ ...touched, path: 'a'.repeat(1025) }).success).toBe(false);
  });

  it('rejects unknown operations and a missing author', () => {
    expect(ThreadEvent.safeParse({ ...touched, op: 'renamed' }).success).toBe(false);
    const { author: omitted, ...withoutAuthor } = touched;
    expect(omitted).toBeDefined();
    expect(ThreadEvent.safeParse(withoutAuthor).success).toBe(false);
  });

  it('keeps tool.start without summaryTruncated valid', () => {
    const start = { type: 'tool.start', toolUseId: 't1', author, tool: 'Bash', summary: '$ ls' };
    expect(ThreadEvent.parse(start)).toEqual(start);
    expect(ThreadEvent.safeParse({ ...start, summaryTruncated: 'yes' }).success).toBe(false);
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

const sha = 'c'.repeat(64);
const ref = { sha256: sha, kind: 'image', mime: 'image/png', name: 'a.png', size: 10, width: 4, height: 4 };

describe('ThreadEvent v2 additions', () => {
  it('parses extended user.message and every pending event', () => {
    const events = [
      {
        type: 'user.message', text: 'hola', pendingId: 'p1', delivery: 'cut-point',
        attachments: [ref], refs: { agents: ['sdd-planner'], skills: [] },
      },
      { type: 'user.message', text: 'otro', delivery: 'next-turn' },
      { type: 'pending.added', pendingId: 'p1', text: 'x', attachments: [ref], refs: { agents: [], skills: ['s'] } },
      { type: 'pending.added', pendingId: 'p2', text: 'solo texto' },
      { type: 'pending.edited', pendingId: 'p1', text: 'y' },
      { type: 'pending.removed', pendingId: 'p1' },
      { type: 'pending.reverted', pendingId: 'p2', reason: 'interrupt' },
    ];
    for (const e of events) expect(ThreadEvent.parse(e)).toEqual(e);
  });
  it('rejects bad delivery, revert reason and too many attachments', () => {
    expect(ThreadEvent.safeParse({ type: 'user.message', text: 'x', delivery: 'now' }).success).toBe(false);
    expect(ThreadEvent.safeParse({ type: 'pending.reverted', pendingId: 'p', reason: 'error' }).success).toBe(false);
    expect(ThreadEvent.safeParse({ type: 'pending.added', pendingId: 'p', text: '', attachments: Array(6).fill(ref) }).success).toBe(false);
  });
  it('parses approval.requested with always offers and approval.resolved with remembered', () => {
    const requested = { type: 'approval.requested', approvalId: 'a', author, tool: 'Bash', summary: '$ git status' };
    for (const always of [
      { kind: 'bash-prefix', prefix: 'git status' },
      { kind: 'tool', tool: 'Edit' },
      { kind: 'none', reason: 'gate-warning' },
    ]) {
      const event = { ...requested, always };
      expect(ThreadEvent.parse(event)).toEqual(event);
    }
    const resolved = { type: 'approval.resolved', approvalId: 'a', decision: 'allow', remembered: { kind: 'tool', tool: 'Edit' } };
    expect(ThreadEvent.parse(resolved)).toEqual(resolved);
  });
});

describe('v1 JSONL lines stay readable', () => {
  const v1Lines = [
    { type: 'user.message', text: 'hola' },
    { type: 'approval.requested', approvalId: 'p1', author, tool: 'Bash', summary: '$ ls', input: '{}', gateWarning: 'w' },
    { type: 'approval.resolved', approvalId: 'p1', decision: 'allow' },
    { type: 'session.status', status: 'idle' },
  ];
  it('parses them unchanged, without inventing new fields', () => {
    for (const line of v1Lines) expect(ThreadEvent.parse(line)).toEqual(line);
  });
  it('replays them inside a thread.event server frame', () => {
    const frame = { kind: 'thread.event', threadId: 't', seq: 3, event: v1Lines[0] };
    expect(ServerEvent.parse(frame)).toEqual(frame);
    expect(decodeServerMessage(JSON.stringify(frame)).ok).toBe(true);
  });
});
