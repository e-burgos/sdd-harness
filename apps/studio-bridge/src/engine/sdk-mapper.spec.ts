import { readFileSync } from 'node:fs';
import type { ThreadEvent } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import { SdkEventMapper } from './sdk-mapper';

const MAIN = 'sdd-orchestrator';

describe('SdkEventMapper (synthetic)', () => {
  it('captures the session id on init', () => {
    const m = new SdkEventMapper(MAIN, null);
    expect(m.mapMessage({ type: 'system', subtype: 'init', session_id: 's1', model: 'claude-haiku' })).toEqual([]);
    expect(m.sessionId).toBe('s1');
  });

  it('maps main-thread text and tool_use, and attributes subagent output', () => {
    const m = new SdkEventMapper(MAIN, null);
    const main = m.mapMessage({
      type: 'assistant', parent_tool_use_id: null,
      message: { id: 'msg1', content: [
        { type: 'text', text: 'voy a delegar' },
        { type: 'tool_use', id: 'toolu_A', name: 'Agent', input: { subagent_type: 'sdd-planner', description: 'plan' } },
      ] },
    });
    expect(main).toEqual([
      { type: 'message.start', messageId: 'msg1:0', author: { agent: MAIN, parentToolUseId: null } },
      { type: 'message.delta', messageId: 'msg1:0', text: 'voy a delegar' },
      { type: 'message.end', messageId: 'msg1:0' },
      { type: 'tool.start', toolUseId: 'toolu_A', author: { agent: MAIN, parentToolUseId: null }, tool: 'Agent', summary: 'sdd-planner: plan' },
    ]);
    const sub = m.mapMessage({
      type: 'assistant', parent_tool_use_id: 'toolu_A',
      message: { id: 'msg2', content: [{ type: 'tool_use', id: 'toolu_B', name: 'Edit', input: { file_path: '/r/a.ts', old_string: 'a', new_string: 'b' } }] },
    });
    expect(sub).toEqual([
      { type: 'tool.start', toolUseId: 'toolu_B', author: { agent: 'sdd-planner', parentToolUseId: 'toolu_A' }, tool: 'Edit', summary: '/r/a.ts', diff: '-a\n+b' },
    ]);
  });

  it('maps tool results, skipping plain user text', () => {
    const m = new SdkEventMapper(MAIN, null);
    expect(m.mapMessage({ type: 'user', parent_tool_use_id: null, message: { content: 'hola' } })).toEqual([]);
    expect(m.mapMessage({
      type: 'user', parent_tool_use_id: null,
      message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_B', is_error: true, content: [{ type: 'text', text: 'denied' }] }] },
    })).toEqual([{ type: 'tool.end', toolUseId: 'toolu_B', isError: true, summary: 'denied' }]);
  });

  it('maps a successful result to turn.end using the most expensive model', () => {
    const m = new SdkEventMapper(MAIN, 'low');
    expect(m.mapMessage({
      type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.02,
      usage: { input_tokens: 10, cache_read_input_tokens: 5, cache_creation_input_tokens: 1, output_tokens: 7 },
      modelUsage: { 'claude-haiku': { costUSD: 0.005 }, 'claude-sonnet': { costUSD: 0.015 } },
    })).toEqual([{ type: 'turn.end', usage: { model: 'claude-sonnet', effort: 'low', tokensIn: 16, tokensOut: 7, costUsd: 0.02 } }]);
  });

  it('reports cost as the delta of cumulative total_cost_usd across results', () => {
    const m = new SdkEventMapper(MAIN, null);
    const result = (cost: number) => m.mapMessage({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: cost, usage: {}, modelUsage: {} });
    const costOf = (out: ThreadEvent[]) => { const e = out[0]; return e?.type === 'turn.end' ? e.usage.costUsd : NaN; };
    expect(costOf(result(0.1))).toBeCloseTo(0.1);
    expect(costOf(result(0.13))).toBeCloseTo(0.03);
    expect(costOf(result(0.1))).toBe(0); // clamped
  });

  it('exposes sawError only after an error result; ignores other system subtypes', () => {
    const m = new SdkEventMapper(MAIN, null);
    expect(m.sawError).toBe(false);
    expect(m.mapMessage({ type: 'system', subtype: 'task_started' })).toEqual([]);
    expect(m.mapMessage({ type: 'rate_limit_event' })).toEqual([]);
    m.mapMessage({ type: 'result', subtype: 'success', is_error: false, usage: {}, modelUsage: {} });
    expect(m.sawError).toBe(false);
    m.mapMessage({ type: 'result', subtype: 'error_max_turns', is_error: true, usage: {}, modelUsage: {} });
    expect(m.sawError).toBe(true);
  });

  it('adds an error status for failed results', () => {
    const m = new SdkEventMapper(MAIN, null);
    const out = m.mapMessage({ type: 'result', subtype: 'error_max_turns', is_error: true, usage: {}, total_cost_usd: 0, modelUsage: {}, errors: ['too many'] });
    expect(out.at(-1)).toEqual({ type: 'session.status', status: 'error', error: { code: 'error_max_turns', message: 'too many' } });
  });

  it('tracks subagents from hooks and attributes approvals by agent id', () => {
    const m = new SdkEventMapper(MAIN, null);
    expect(m.mapHook({ hook_event_name: 'SubagentStart', agent_id: 'ag1', agent_type: 'sdd-planner' })).toEqual([
      { type: 'subagent.start', agentId: 'ag1', agentType: 'sdd-planner' },
    ]);
    expect(m.authorForAgentId('ag1')).toEqual({ agent: 'sdd-planner', parentToolUseId: null });
    expect(m.authorForAgentId(undefined)).toEqual({ agent: MAIN, parentToolUseId: null });
    expect(m.mapHook({ hook_event_name: 'SubagentStop', agent_id: 'ag1', agent_type: 'sdd-planner' })).toEqual([
      { type: 'subagent.stop', agentId: 'ag1', agentType: 'sdd-planner' },
    ]);
    expect(m.mapHook({ hook_event_name: 'PreToolUse' })).toEqual([]);
  });
});

type Rec = { kind: 'message' | 'hook' | 'canUseTool' | 'error'; data: any };
const replay = (name: string): { events: ThreadEvent[]; records: Rec[] } => {
  const records = readFileSync(new URL(`./__fixtures__/${name}.jsonl`, import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l) as Rec);
  const m = new SdkEventMapper(MAIN, 'low');
  // 'error' lines are ignored by the replay
  const events = records.flatMap((r) => (r.kind === 'message' ? m.mapMessage(r.data) : r.kind === 'hook' ? m.mapHook(r.data) : []));
  return { events, records };
};

describe('SdkEventMapper (recorded fixtures)', () => {
  it('simple: main agent speaks and the turn ends with tokens', () => {
    const { events } = replay('simple');
    expect(events.some((e) => e.type === 'message.start' && e.author.agent === MAIN && e.author.parentToolUseId === null)).toBe(true);
    const ends = events.filter((e) => e.type === 'turn.end');
    expect(ends).toHaveLength(1);
    expect(ends[0]?.type === 'turn.end' && ends[0].usage.tokensIn).toBeGreaterThan(0);
  });

  it('subagent: the planner starts and is credited for its output', () => {
    const { events } = replay('subagent');
    expect(events).toContainEqual(expect.objectContaining({ type: 'subagent.start', agentType: 'sdd-planner' }));
    expect(events.some((e) => (e.type === 'message.start' || e.type === 'tool.start') && e.author.agent === 'sdd-planner')).toBe(true);
  });

  it('permission: canUseTool carried a tool use id and the denied Write ends in error', () => {
    const { events, records } = replay('permission');
    const ask = records.find((r) => r.kind === 'canUseTool');
    expect(ask?.data.toolName).toBe('Write');
    expect(typeof ask?.data.toolUseID).toBe('string');
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool.end', isError: true }));
  });

  it('interrupt: mapping completes without throwing', () => {
    expect(() => replay('interrupt')).not.toThrow();
  });
});