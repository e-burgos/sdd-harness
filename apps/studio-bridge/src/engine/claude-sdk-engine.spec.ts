import { readFileSync } from 'node:fs';
import type { Options, Query } from '@anthropic-ai/claude-agent-sdk';
import { defaultThreadOptions, type ThreadEvent } from '@sdd-studio/protocol';
import { describe, expect, it, vi } from 'vitest';
import { buildQueryOptions, ClaudeAgentSdkEngine, type QueryFn } from './claude-sdk-engine';
import type { ApprovalRequest, EngineCallbacks, EngineTurnInput } from './types';

type EngineCallbacksApproval = EngineCallbacks['requestApproval'];

const input = (over: Partial<EngineTurnInput['options']> = {}, resume: string | null = null): EngineTurnInput => ({
  threadId: 't', text: 'hola', cwd: '/repo', resumeSessionId: resume, options: { ...defaultThreadOptions(), ...over },
});
const handlers = () => ({ abort: new AbortController(), canUseTool: vi.fn(), onHook: vi.fn(), judgeTool: vi.fn() });

describe('buildQueryOptions', () => {
  it('leaves model, effort and agent to the kit by default', () => {
    const o = buildQueryOptions(input(), handlers());
    expect(o).toMatchObject({ cwd: '/repo', settingSources: ['project'], forwardSubagentText: true, permissionMode: 'default' });
    expect(o.model).toBeUndefined();
    expect(o.effort).toBeUndefined();
    expect(o.agent).toBeUndefined();
    expect(o.resume).toBeUndefined();
    expect(Object.keys(o.hooks ?? {})).toEqual(['SubagentStart', 'SubagentStop', 'PreToolUse']);
  });
  describe('PreToolUse hook', () => {
    const call = async (verdict: unknown) => {
      const h = { ...handlers(), judgeTool: vi.fn(() => verdict) };
      const o = buildQueryOptions(input(), h as never);
      const hook = o.hooks?.PreToolUse?.[0]?.hooks[0];
      const out = await hook!(
        { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: '/r/a.ts' }, tool_use_id: 'tu1', agent_id: undefined } as never,
        'tu1', { signal: new AbortController().signal });
      return { out, h };
    };
    it('returns the SDK deny shape for a gated edit', async () => {
      const { out, h } = await call({ kind: 'deny', reason: 'SPEC GATE x' });
      expect(out).toEqual({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'SPEC GATE x' } });
      expect(h.judgeTool).toHaveBeenCalledWith('Write', { file_path: '/r/a.ts' }, expect.objectContaining({ tool_use_id: 'tu1' }));
    });
    it('asks on a warn so canUseTool is consulted', async () => {
      const { out } = await call({ kind: 'warn', reason: 'w' });
      expect(out).toMatchObject({ hookSpecificOutput: { permissionDecision: 'ask' } });
    });
    it('does not decide on allow', async () => {
      expect((await call({ kind: 'allow' })).out).toEqual({});
    });
  });
  it('pins model and effort, uses the DM agent and resumes', () => {
    const o = buildQueryOptions(input({ agent: 'sdd-planner', model: 'opus', effort: 'high', permissionMode: 'plan' }, 'sess-1'), handlers());
    expect(o).toMatchObject({ agent: 'sdd-planner', model: 'opus', effort: 'high', permissionMode: 'plan', resume: 'sess-1' });
  });
  it('ignores effort when the model is kit', () => {
    expect(buildQueryOptions(input({ effort: 'max' }), handlers()).effort).toBeUndefined();
  });
});

type Rec = { kind: 'message' | 'hook' | 'canUseTool' | 'error'; data: any };
function replayQuery(name: string): { fn: QueryFn; interrupt: ReturnType<typeof vi.fn> } {
  const records = readFileSync(new URL(`./__fixtures__/${name}.jsonl`, import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l) as Rec);
  const interrupt = vi.fn(async () => undefined);
  const fn: QueryFn = ({ options }) => {
    const signal = new AbortController().signal;
    async function* run() {
      for (const r of records) {
        if (r.kind === 'message') yield r.data;
        else if (r.kind === 'hook') {
          const matcher = options?.hooks?.[r.data.hook_event_name as 'SubagentStart']?.[0];
          await matcher?.hooks[0]?.(r.data, undefined, { signal });
        } else if (r.kind === 'error') {
          throw new Error(r.data.message ?? 'error');
        } else {
          await options?.canUseTool?.(r.data.toolName, r.data.input, { signal, toolUseID: r.data.toolUseID, agentID: r.data.agentID ?? undefined } as never);
        }
      }
    }
    return Object.assign(run(), { interrupt }) as unknown as Query;
  };
  return { fn, interrupt };
}

describe('ClaudeAgentSdkEngine', () => {
  it('streams mapped events, reports the session id and routes approvals', async () => {
    const { fn } = replayQuery('permission');
    const events: ThreadEvent[] = [];
    const sessions: string[] = [];
    const asked: ApprovalRequest[] = [];
    const turn = new ClaudeAgentSdkEngine(fn).startTurn(input(), {
      emit: (e) => events.push(e),
      onSessionId: (id) => sessions.push(id),
      judgeTool: () => ({ kind: 'allow' }), requestApproval: async (r) => (asked.push(r), { behavior: 'deny', message: 'no' }),
    });
    await turn.done;
    expect(sessions).toHaveLength(1);
    expect(asked[0]).toMatchObject({ toolName: 'Write', author: { agent: 'sdd-orchestrator' } });
    expect(typeof asked[0]?.toolUseId).toBe('string');
    expect(events.some((e) => e.type === 'turn.end')).toBe(true);
  });

  it('interrupts through the query', async () => {
    const { fn, interrupt } = replayQuery('simple');
    const turn = new ClaudeAgentSdkEngine(fn).startTurn(input(), {
      emit: () => {}, onSessionId: () => {}, judgeTool: () => ({ kind: 'allow' }), requestApproval: async () => ({ behavior: 'allow' }),
    });
    await turn.interrupt();
    await turn.done;
    expect(interrupt).toHaveBeenCalledOnce();
  });

  const start = (fn: QueryFn) =>
    new ClaudeAgentSdkEngine(fn).startTurn(input(), {
      emit: () => {}, onSessionId: () => {}, judgeTool: () => ({ kind: 'allow' }), requestApproval: async () => ({ behavior: 'allow' }),
    });

  it('swallows the iterator error after an interrupt', async () => {
    const { fn } = replayQuery('interrupt');
    const turn = start(fn);
    await turn.interrupt();
    await expect(turn.done).resolves.toBeUndefined();
  });

  it('swallows the iterator error when an error result was already mapped', async () => {
    const { fn } = replayQuery('interrupt');
    await expect(start(fn).done).resolves.toBeUndefined();
  });

  it('rejects when the iterator throws with no error result and no interrupt', async () => {
    const fn: QueryFn = () => {
      async function* run() {
        yield { type: 'system', subtype: 'init', session_id: 's', model: 'm' };
        throw new Error('boom');
      }
      return Object.assign(run(), { interrupt: async () => undefined }) as unknown as Query;
    };
    await expect(start(fn).done).rejects.toThrow('boom');
  });

  it('swallows a throw with no error result only when interrupt() was called', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fn: QueryFn = () => {
      async function* run() {
        yield { type: 'system', subtype: 'init', session_id: 's', model: 'm' };
        await gate;
        throw new Error('after interrupt');
      }
      return Object.assign(run(), { interrupt: async () => release() }) as unknown as Query;
    };
    const turn = start(fn);
    await turn.interrupt();
    await expect(turn.done).resolves.toBeUndefined();
  });

  describe('canUseTool contract', () => {
    const run = async (
      decision: Awaited<ReturnType<EngineCallbacksApproval>>,
      toolUseID: string | undefined,
    ) => {
      const asked: { req: ApprovalRequest; signal: AbortSignal }[] = [];
      const sdkSignal = new AbortController().signal;
      const toolInput = { file_path: '/r/a.ts' };
      let result: unknown;
      const fn: QueryFn = ({ options }) => {
        async function* gen() {
          result = await options?.canUseTool?.('Write', toolInput, { signal: sdkSignal, toolUseID, agentID: undefined } as never);
        }
        return Object.assign(gen(), { interrupt: async () => undefined }) as unknown as Query;
      };
      await new ClaudeAgentSdkEngine(fn).startTurn(input(), {
        emit: () => {}, onSessionId: () => {},
        judgeTool: () => ({ kind: 'allow' }), requestApproval: async (req, signal) => (asked.push({ req, signal }), decision),
      }).done;
      return { result, asked, sdkSignal, toolInput };
    };

    it('allow returns the same input as updatedInput and forwards the SDK signal', async () => {
      const { result, asked, sdkSignal, toolInput } = await run({ behavior: 'allow' }, 'tu1');
      expect(result).toEqual({ behavior: 'allow', updatedInput: toolInput });
      expect(asked[0]?.signal).toBe(sdkSignal);
      expect(asked[0]?.req.toolUseId).toBe('tu1');
    });
    it('deny carries the callback message', async () => {
      const { result } = await run({ behavior: 'deny', message: 'nope' }, 'tu1');
      expect(result).toEqual({ behavior: 'deny', message: 'nope' });
    });
    it('missing toolUseID becomes null', async () => {
      const { asked } = await run({ behavior: 'allow' }, undefined);
      expect(asked[0]?.req.toolUseId).toBeNull();
    });
  });
});
