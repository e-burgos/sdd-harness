import { query as sdkQuery, type HookInput, type Options, type Query } from '@anthropic-ai/claude-agent-sdk';
import { DEFAULT_AGENT } from '@sdd-studio/protocol';
import { SdkEventMapper, type SdkMessageLike } from './sdk-mapper';
import type { AgentEngine, EngineCallbacks, EngineTurn, EngineTurnInput } from './types';

export type QueryFn = (params: { prompt: string; options?: Options }) => Query;

export function buildQueryOptions(
  input: EngineTurnInput,
  h: { abort: AbortController; canUseTool: NonNullable<Options['canUseTool']>; onHook: (input: unknown) => void },
): Options {
  const { agent, model, effort, permissionMode } = input.options;
  const hook = [{ hooks: [async (hookInput: HookInput) => (h.onHook(hookInput), {})] }];
  const options: Options = {
    cwd: input.cwd,
    abortController: h.abort,
    settingSources: ['project'],
    forwardSubagentText: true,
    permissionMode,
    canUseTool: h.canUseTool,
    hooks: { SubagentStart: hook, SubagentStop: hook },
  };
  if (agent !== DEFAULT_AGENT) options.agent = agent;
  if (model !== 'kit') {
    options.model = model;
    if (effort) options.effort = effort;
  }
  if (input.resumeSessionId) options.resume = input.resumeSessionId;
  return options;
}

export class ClaudeAgentSdkEngine implements AgentEngine {
  readonly name = 'claude-agent-sdk';

  constructor(private readonly queryFn: QueryFn = sdkQuery as QueryFn) {}

  startTurn(input: EngineTurnInput, cb: EngineCallbacks): EngineTurn {
    const abort = new AbortController();
    const mapper = new SdkEventMapper(input.options.agent, input.options.model === 'kit' ? null : input.options.effort);
    const emitAll = (events: ReturnType<SdkEventMapper['mapMessage']>) => {
      for (const event of events) cb.emit(event);
    };
    const q = this.queryFn({
      prompt: input.text,
      options: buildQueryOptions(input, {
        abort,
        onHook: (hookInput) => emitAll(mapper.mapHook(hookInput as Parameters<SdkEventMapper['mapHook']>[0])),
        canUseTool: async (toolName, toolInput, opts) => {
          const decision = await cb.requestApproval(
            { toolName, input: toolInput, author: mapper.authorForAgentId(opts.agentID), toolUseId: opts.toolUseID ?? null },
            opts.signal,
          );
          return decision.behavior === 'allow'
            ? { behavior: 'allow', updatedInput: toolInput }
            : { behavior: 'deny', message: decision.message };
        },
      }),
    });
    let interrupted = false;
    const done = (async () => {
      try {
        for await (const message of q) {
          const msg = message as unknown as SdkMessageLike;
          if (msg.type === 'system' && msg.subtype === 'init' && typeof msg.session_id === 'string') {
            cb.onSessionId(msg.session_id);
          }
          emitAll(mapper.mapMessage(msg));
        }
      } catch (error) {
        // The real iterator throws after an interrupt or an error result; that is already reported as events.
        if (!interrupted && !mapper.sawError) throw error;
      }
    })();
    return {
      done,
      interrupt: async () => {
        interrupted = true;
        try {
          await q.interrupt();
        } catch {
          abort.abort();
        }
      },
    };
  }
}