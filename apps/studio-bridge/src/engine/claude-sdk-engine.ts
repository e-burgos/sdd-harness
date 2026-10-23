import { query as sdkQuery, type HookInput, type Options, type PreToolUseHookInput, type Query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { DEFAULT_AGENT, type ThreadOptions } from '@sdd-studio/protocol';
import { InputChannel } from './input-channel';
import { toSdkUserMessage } from './prompt-content';
import type { JudgeContext, ToolVerdict } from './types';
import { SdkEventMapper, type SdkMessageLike } from './sdk-mapper';
import type { AgentEngine, EngineCallbacks, EngineTurn, EngineTurnInput } from './types';

export type QueryFn = (params: { prompt: AsyncIterable<SDKUserMessage>; options?: Options }) => Query;

// Full ids, not aliases: a live run with model 'haiku' reported init.model haiku but was billed as
// claude-sonnet-5-5. Update when the kit's tier table moves to newer models.
export const MODEL_IDS: Record<Exclude<ThreadOptions['model'], 'kit'>, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
  fable: 'claude-fable-5-1',
};

export function buildQueryOptions(
  input: EngineTurnInput,
  h: {
    abort: AbortController;
    canUseTool: NonNullable<Options['canUseTool']>;
    onHook: (input: unknown) => void;
    judgeTool: (toolName: string, input: Record<string, unknown>, hookInput: PreToolUseHookInput) => ToolVerdict;
    env?: Record<string, string | undefined>;
  },
): Options {
  const { agent, model, effort, permissionMode } = input.options;
  const bypass = permissionMode === 'bypassPermissions';
  const hook = [{ hooks: [async (hookInput: HookInput) => (h.onHook(hookInput), {})] }];
  const options: Options = {
    cwd: input.cwd,
    abortController: h.abort,
    settingSources: ['project'],
    forwardSubagentText: true,
    permissionMode,
    canUseTool: h.canUseTool,
    hooks: {
      SubagentStart: hook,
      SubagentStop: hook,
      // SPEC GATE: runs for every tool use, also in acceptEdits mode and for tools allowed by permissions.allow
      // (canUseTool is not consulted there). A warn becomes 'ask' so canUseTool (and its gateWarning) is consulted.
      PreToolUse: [
        {
          hooks: [
            async (hookInput: HookInput) => {
              if (hookInput.hook_event_name !== 'PreToolUse') return {};
              const toolInput =
                hookInput.tool_input && typeof hookInput.tool_input === 'object' ? (hookInput.tool_input as Record<string, unknown>) : {};
              const verdict = h.judgeTool(hookInput.tool_name, toolInput, hookInput);
              if (verdict.kind === 'deny') {
                return { hookSpecificOutput: { hookEventName: 'PreToolUse' as const, permissionDecision: 'deny' as const, permissionDecisionReason: verdict.reason } };
              }
              if (verdict.kind === 'warn' && !bypass) {
                return { hookSpecificOutput: { hookEventName: 'PreToolUse' as const, permissionDecision: 'ask' as const, permissionDecisionReason: verdict.reason } };
              }
              return {};
            },
          ],
        },
      ],
    },
  };
  if (bypass) options.allowDangerouslySkipPermissions = true;
  if (h.env) options.env = h.env;
  if (agent !== DEFAULT_AGENT) options.agent = agent;
  if (model !== 'kit') {
    options.model = MODEL_IDS[model];
    if (effort) options.effort = effort;
  }
  if (input.resumeSessionId) options.resume = input.resumeSessionId;
  return options;
}

export class ClaudeAgentSdkEngine implements AgentEngine {
  readonly name = 'claude-agent-sdk';

  constructor(
    private readonly queryFn: QueryFn = sdkQuery as QueryFn,
    private readonly getEnv?: () => Record<string, string | undefined>,
  ) {}

  startTurn(input: EngineTurnInput, cb: EngineCallbacks): EngineTurn {
    const abort = new AbortController();
    const mapper = new SdkEventMapper(input.options.agent, input.options.model === 'kit' ? null : input.options.effort);
    const emitAll = (events: ReturnType<SdkEventMapper['mapMessage']>) => {
      for (const event of events) cb.emit(event);
    };
    const channel = new InputChannel<SDKUserMessage>();
    channel.push(input.prompts.map(toSdkUserMessage));
    const q = this.queryFn({
      prompt: channel,
      options: buildQueryOptions(input, {
        abort,
        env: this.getEnv?.(),
        judgeTool: (toolName, toolInput, hookInput) =>
          cb.judgeTool(toolName, toolInput, {
            author: mapper.authorForAgentId(hookInput.agent_id),
            toolUseId: hookInput.tool_use_id || null,
          } satisfies JudgeContext),
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
    const deliverOrClose = (result: SdkMessageLike): void => {
      if (interrupted || mapper.sawError) {
        channel.end();
        return;
      }
      const next = cb.collectPending('turn-end');
      if (next.length > 0) channel.push(next.map(toSdkUserMessage));
      else if (!(Number(result.queued_turn_count) > 0)) channel.end();
    };
    const done = (async () => {
      try {
        for await (const message of q) {
          const msg = message as unknown as SdkMessageLike;
          if (msg.type === 'system' && msg.subtype === 'init' && typeof msg.session_id === 'string') {
            cb.onSessionId(msg.session_id);
          }
          emitAll(mapper.mapMessage(msg));
          if (msg.type === 'result') deliverOrClose(msg);
        }
      } catch (error) {
        // The real iterator throws after an interrupt or an error result; that is already reported as events.
        if (!interrupted && !mapper.sawError) throw error;
      } finally {
        channel.end();
      }
    })();
    return {
      done,
      interrupt: async () => {
        interrupted = true;
        try {
          const receipt = await q.interrupt();
          const notDelivered = receipt?.still_queued ?? [];
          if (notDelivered.length > 0) {
            cb.revertPending(notDelivered);
            abort.abort();
          }
        } catch {
          abort.abort();
        }
        channel.end();
      },
    };
  }
}