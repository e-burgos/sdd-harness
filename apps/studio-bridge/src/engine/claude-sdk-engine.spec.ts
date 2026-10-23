import { readFileSync } from 'node:fs';
import type { Options, Query } from '@anthropic-ai/claude-agent-sdk';
import { defaultThreadOptions, type ThreadEvent } from '@sdd-studio/protocol';
import { describe, expect, it, vi } from 'vitest';
import { buildQueryOptions, ClaudeAgentSdkEngine, type QueryFn } from './claude-sdk-engine';
import { plainPrompt, type ApprovalRequest, type EngineCallbacks, type EngineTurnInput } from './types';

const noPending = { collectPending: () => [], revertPending: () => {} };
type EngineCallbacksApproval = EngineCallbacks['requestApproval'];

const input = (over: Partial<EngineTurnInput['options']> = {}, resume: string | null = null): EngineTurnInput => ({
  threadId: 't', prompts: [{ id: 'u-1', prompt: plainPrompt('hola') }], cwd: '/repo', resumeSessionId: resume, options: { ...defaultThreadOptions(), ...over },
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
  it('passes the env through (it replaces the subprocess environment) and omits it when absent', () => {
    const env = { PATH: '/bin', ANTHROPIC_API_KEY: 'k', CLAUDE_AGENT_SDK_CLIENT_APP: 'sdd-studio/1.0.0' };
    expect(buildQueryOptions(input(), { ...handlers(), env }).env).toEqual(env);
    expect('env' in buildQueryOptions(input(), handlers())).toBe(false);
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
    it('lets a warn through in bypassPermissions mode but still denies', async () => {
      const callBypass = async (verdict: unknown) => {
        const o = buildQueryOptions(input({ permissionMode: 'bypassPermissions' }), { ...handlers(), judgeTool: vi.fn(() => verdict) } as never);
        return o.hooks!.PreToolUse![0]!.hooks[0]!(
          { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: {}, tool_use_id: 'tu1', agent_id: undefined } as never,
          'tu1', { signal: new AbortController().signal });
      };
      expect(await callBypass({ kind: 'warn', reason: 'w' })).toEqual({});
      expect(await callBypass({ kind: 'deny', reason: 'd' })).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } });
    });
  });
  it('opts into skipping permissions only in bypassPermissions mode', () => {
    expect(buildQueryOptions(input({ permissionMode: 'bypassPermissions' }), handlers())).toMatchObject({
      permissionMode: 'bypassPermissions', allowDangerouslySkipPermissions: true,
    });
    expect(buildQueryOptions(input(), handlers()).allowDangerouslySkipPermissions).toBeUndefined();
  });
  it('pins model and effort, uses the DM agent and resumes', () => {
    const o = buildQueryOptions(input({ agent: 'sdd-planner', model: 'opus', effort: 'high', permissionMode: 'plan' }, 'sess-1'), handlers());
    expect(o).toMatchObject({ agent: 'sdd-planner', model: 'claude-opus-5-5', effort: 'high', permissionMode: 'plan', resume: 'sess-1' });
  });
  // Aliases are not reliable: a live run with model 'haiku' was billed as claude-sonnet-5-5.
  it.each([
    ['haiku', 'claude-haiku-4-5-20251001'],
    ['sonnet', 'claude-sonnet-5-5'],
    ['opus', 'claude-opus-5-5'],
    ['fable', 'claude-fable-5-1'],
  ] as const)('pins %s to the full model id %s', (choice, id) => {
    expect(buildQueryOptions(input({ model: choice }), handlers()).model).toBe(id);
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
      judgeTool: () => ({ kind: 'allow' }), ...noPending, requestApproval: async (r) => (asked.push(r), { behavior: 'deny', message: 'no' }),
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
      emit: () => {}, onSessionId: () => {}, judgeTool: () => ({ kind: 'allow' }), ...noPending, requestApproval: async () => ({ behavior: 'allow' }),
    });
    await turn.interrupt();
    await turn.done;
    expect(interrupt).toHaveBeenCalledOnce();
  });

  const start = (fn: QueryFn) =>
    new ClaudeAgentSdkEngine(fn).startTurn(input(), {
      emit: () => {}, onSessionId: () => {}, judgeTool: () => ({ kind: 'allow' }), ...noPending, requestApproval: async () => ({ behavior: 'allow' }),
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
        judgeTool: () => ({ kind: 'allow' }), ...noPending, requestApproval: async (req, signal) => (asked.push({ req, signal }), decision),
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

describe('ClaudeAgentSdkEngine prompt streaming', () => {
  const resultMessage = (extra: Record<string, unknown> = {}) => ({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0, usage: {}, ...extra });
  const outgoing = (id: string, text: string) => ({ id, prompt: plainPrompt(text) });

  function scriptedQuery(script: (ctx: { signal: AbortSignal }) => AsyncGenerator<unknown>, interrupt: Query['interrupt'] = async () => undefined) {
    const consumed: Array<{ uuid?: string; text: string }> = [];
    let channelEnded = false;
    const fn: QueryFn = ({ prompt, options }) => {
      void (async () => {
        for await (const message of prompt) {
          const content = message.message.content as Array<{ text: string }>;
          consumed.push({ uuid: message.uuid, text: content.map((block) => block.text).join('') });
        }
        channelEnded = true;
      })();
      return Object.assign(script({ signal: options?.abortController?.signal as AbortSignal }), { interrupt }) as unknown as Query;
    };
    return { fn, consumed, channelEnded: () => channelEnded };
  }

  const callbacks = (over: Partial<EngineCallbacks> = {}): EngineCallbacks => ({
    emit: () => {}, onSessionId: () => {}, judgeTool: () => ({ kind: 'allow' }), requestApproval: async () => ({ behavior: 'allow' }), ...noPending, ...over,
  });
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('feeds every initial prompt to the stream stamped with its uuid and closes it after the result', async () => {
    const { fn, consumed, channelEnded } = scriptedQuery(async function* () {
      await tick();
      yield resultMessage();
    });
    const turn = new ClaudeAgentSdkEngine(fn).startTurn(
      { ...input(), prompts: [outgoing('u-1', 'first'), outgoing('u-2', 'second')] },
      callbacks(),
    );
    await turn.done;
    await tick();
    expect(consumed).toEqual([{ uuid: 'u-1', text: 'first' }, { uuid: 'u-2', text: 'second' }]);
    expect(channelEnded()).toBe(true);
  });

  it('pushes the pending collected at turn end as the next turn of the same query', async () => {
    const collect = vi.fn((at: 'cut-point' | 'turn-end') => (at === 'turn-end' && collect.mock.calls.length === 1 ? [outgoing('p-1', 'later')] : []));
    const { fn, consumed } = scriptedQuery(async function* () {
      await tick();
      yield resultMessage();
      await tick();
      yield resultMessage();
    });
    await new ClaudeAgentSdkEngine(fn).startTurn(input(), callbacks({ collectPending: collect })).done;
    await tick();
    expect(collect).toHaveBeenCalledTimes(2);
    expect(collect).toHaveBeenCalledWith('turn-end');
    expect(consumed.map((c) => c.uuid)).toEqual(['u-1', 'p-1']);
  });

  it('keeps the stream open while the CLI still has queued turns', async () => {
    const { fn, channelEnded } = scriptedQuery(async function* () {
      yield resultMessage({ queued_turn_count: 1 });
      await tick();
      await tick();
      expect(channelEnded()).toBe(false);
      yield resultMessage();
    });
    await new ClaudeAgentSdkEngine(fn).startTurn(input(), callbacks()).done;
  });

  it('does not collect pending after an error result', async () => {
    const collect = vi.fn(() => [outgoing('p-1', 'x')]);
    const { fn } = scriptedQuery(async function* () {
      yield resultMessage({ subtype: 'error_during_execution', is_error: true, errors: ['boom'] });
    });
    await new ClaudeAgentSdkEngine(fn).startTurn(input(), callbacks({ collectPending: collect })).done;
    expect(collect).not.toHaveBeenCalled();
  });

  describe('interrupt receipt', () => {
    const run = async (receipt: Awaited<ReturnType<Query['interrupt']>>) => {
      const revert = vi.fn();
      let aborted = false;
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const { fn, channelEnded } = scriptedQuery(
        async function* ({ signal }) {
          signal.addEventListener('abort', () => (aborted = true));
          yield { type: 'system', subtype: 'init', session_id: 's', model: 'm' };
          await gate;
        },
        async () => (release(), receipt),
      );
      const turn = new ClaudeAgentSdkEngine(fn).startTurn(input(), callbacks({ revertPending: revert }));
      await tick();
      await turn.interrupt();
      await turn.done;
      await tick();
      return { revert, aborted, channelEnded: channelEnded() };
    };

    it('reverts the messages the CLI did not consume and aborts so they do not run', async () => {
      const out = await run({ still_queued: ['p-1', 'p-2'] } as never);
      expect(out.revert).toHaveBeenCalledWith(['p-1', 'p-2']);
      expect(out.aborted).toBe(true);
      expect(out.channelEnded).toBe(true);
    });

    it('reverts nothing when the receipt is empty or missing', async () => {
      for (const receipt of [undefined, { still_queued: [] }]) {
        const out = await run(receipt as never);
        expect(out.revert).not.toHaveBeenCalled();
        expect(out.aborted).toBe(false);
      }
    });
  });
});

describe('PostToolBatch delivery', () => {
  const batchInput = (agentId?: string) => ({ hook_event_name: 'PostToolBatch', tool_calls: [], ...(agentId ? { agent_id: agentId } : {}) }) as never;
  const message = { id: 'p-1', prompt: plainPrompt('also check the tests') };

  async function startAndFire(mode: 'stream' | 'hook-context', batch: ReturnType<typeof batchInput>, collect = vi.fn((_at: 'cut-point' | 'turn-end') => [message])) {
    const consumed: string[] = [];
    let output: unknown;
    const fn: QueryFn = ({ prompt, options }) => {
      void (async () => {
        for await (const sdkMessage of prompt) consumed.push(String(sdkMessage.uuid));
      })();
      async function* run() {
        output = await options?.hooks?.PostToolBatch?.[0]?.hooks[0]?.(batch, undefined, { signal: new AbortController().signal });
      }
      return Object.assign(run(), { interrupt: async () => undefined }) as unknown as Query;
    };
    const turn = new ClaudeAgentSdkEngine(fn, undefined, mode).startTurn(input(), {
      emit: () => {}, onSessionId: () => {}, judgeTool: () => ({ kind: 'allow' }), requestApproval: async () => ({ behavior: 'allow' }),
      collectPending: collect, revertPending: () => {},
    });
    await turn.done;
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { consumed, output, collect };
  }

  it('registers the hook only when the engine delivers at cut points', () => {
    const h = { abort: new AbortController(), canUseTool: vi.fn(), onHook: vi.fn(), judgeTool: vi.fn(), deliverAtCutPoint: async () => ({}) };
    expect(Object.keys(buildQueryOptions(input(), h).hooks ?? {})).toContain('PostToolBatch');
  });

  it('stream mode writes the collected messages to the input stream and returns an empty output', async () => {
    const { consumed, output, collect } = await startAndFire('stream', batchInput());
    expect(collect).toHaveBeenCalledWith('cut-point');
    expect(consumed).toEqual(['u-1', 'p-1']);
    expect(output).toEqual({});
  });

  it('hook-context mode hands the text to the model as additionalContext without touching the stream', async () => {
    const { consumed, output } = await startAndFire('hook-context', batchInput());
    expect(consumed).toEqual(['u-1']);
    expect(output).toEqual({
      hookSpecificOutput: { hookEventName: 'PostToolBatch', additionalContext: 'Message from the user, sent while you were working:\nalso check the tests' },
    });
  });

  it('does nothing when no message is pending', async () => {
    const { consumed, output } = await startAndFire('stream', batchInput(), vi.fn(() => []));
    expect(consumed).toEqual(['u-1']);
    expect(output).toEqual({});
  });

  it('ignores batches that belong to a subagent', async () => {
    const { output, collect } = await startAndFire('stream', batchInput('sub-1'));
    expect(collect).not.toHaveBeenCalled();
    expect(output).toEqual({});
  });
});
