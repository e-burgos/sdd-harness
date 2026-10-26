import {
  getSessionInfo as sdkGetSessionInfo,
  query as sdkQuery,
  type HookInput,
  type HookJSONOutput,
  type Options,
  type PostToolUseFailureHookInput,
  type PostToolUseHookInput,
  type PreToolUseHookInput,
  type Query,
  type SDKSessionInfo,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { DEFAULT_AGENT, type ThreadOptions } from '@sdd-studio/protocol';
import { InputChannel } from './input-channel';
import { toHookContext, toSdkUserMessage } from './prompt-content';
import type { JudgeContext, ToolOutcome, ToolRunContext, ToolVerdict } from './types';
import { SdkEventMapper, type SdkMessageLike } from './sdk-mapper';
import { truncate } from './tool-summary';
import type { AgentEngine, EngineCallbacks, EngineTurn, EngineTurnInput, OutgoingMessage } from './types';

export type DeliveryMode = 'stream' | 'hook-context';

export type QueryFn = (params: { prompt: AsyncIterable<SDKUserMessage>; options?: Options }) => Query;

// Full ids, not aliases: a live run with model 'haiku' reported init.model haiku but was billed as
// claude-sonnet-5-5. Update when the kit's tier table moves to newer models.
export const MODEL_IDS: Record<Exclude<ThreadOptions['model'], 'kit'>, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
  fable: 'claude-fable-5-1',
};

export const SESSION_TITLE_MAX = 300;

export type SessionInfoFn = (sessionId: string, options?: { dir?: string }) => Promise<SDKSessionInfo | undefined>;

export function cleanTitle(raw: string | undefined | null): string | null {
  const collapsed = (raw ?? '').replace(/\s+/g, ' ').trim();
  return collapsed ? truncate(collapsed, SESSION_TITLE_MAX) : null;
}

export function pickSessionTitle(
  info: Pick<SDKSessionInfo, 'customTitle' | 'summary' | 'firstPrompt'> | undefined,
): string | null {
  const custom = cleanTitle(info?.customTitle);
  if (custom) return custom;
  const summary = cleanTitle(info?.summary);
  const first = cleanTitle(info?.firstPrompt);
  return summary && summary !== first ? summary : null;
}

const CONTEXT_USAGE_TIMEOUT_MS = 2_000;

const withTimeout = <T,>(work: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    work.then(
      (value) => (clearTimeout(timer), resolve(value)),
      (error) => (clearTimeout(timer), reject(error)),
    );
  });

export const TRACKED_TOOLS: ReadonlySet<string> = new Set(['Bash', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

export function buildQueryOptions(
  input: EngineTurnInput,
  h: {
    abort: AbortController;
    canUseTool: NonNullable<Options['canUseTool']>;
    onHook: (input: unknown) => void;
    judgeTool: (toolName: string, input: Record<string, unknown>, hookInput: PreToolUseHookInput) => ToolVerdict;
    deliverAtCutPoint?: () => Promise<HookJSONOutput>;
    beforeTool?: (hookInput: PreToolUseHookInput) => Promise<void>;
    afterTool?: (hookInput: PostToolUseHookInput | PostToolUseFailureHookInput, outcome: ToolOutcome) => Promise<void>;
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
              if (h.beforeTool && TRACKED_TOOLS.has(hookInput.tool_name)) await h.beforeTool(hookInput);
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
  if (h.deliverAtCutPoint) {
    const deliver = h.deliverAtCutPoint;
    options.hooks = {
      ...options.hooks,
      PostToolBatch: [
        { hooks: [async (hookInput: HookInput) => (hookInput.hook_event_name === 'PostToolBatch' && !hookInput.agent_id ? deliver() : {})] },
      ],
    };
  }
  if (h.afterTool) {
    const after = h.afterTool;
    options.hooks = {
      ...options.hooks,
      PostToolUse: [
        {
          hooks: [
            async (hookInput: HookInput) =>
              hookInput.hook_event_name === 'PostToolUse' && TRACKED_TOOLS.has(hookInput.tool_name) ? (await after(hookInput, 'ok'), {}) : {},
          ],
        },
      ],
      PostToolUseFailure: [
        {
          hooks: [
            async (hookInput: HookInput) =>
              hookInput.hook_event_name === 'PostToolUseFailure' && TRACKED_TOOLS.has(hookInput.tool_name)
                ? (await after(hookInput, hookInput.is_interrupt ? 'interrupted' : 'failed'), {})
                : {},
          ],
        },
      ],
    };
  }
  if (bypass) options.allowDangerouslySkipPermissions = true;
  if (h.env) options.env = h.env;
  if (agent !== DEFAULT_AGENT) options.agent = agent;
  if (model !== 'kit') {
    options.model = MODEL_IDS[model];
    if (effort) options.effort = effort;
  }
  if (input.resumeSessionId) options.resume = input.resumeSessionId;
  if (input.systemPrefix) {
    options.systemPrompt = {
      type: 'preset',
      preset: 'claude_code',
      append: input.systemPrefix,
      excludeDynamicSections: true,
      snapshot: true,
    };
  }
  return options;
}

function toolRunContext(
  hookInput: PreToolUseHookInput | PostToolUseHookInput | PostToolUseFailureHookInput,
  mapper: SdkEventMapper,
): ToolRunContext {
  return {
    toolName: hookInput.tool_name,
    input: hookInput.tool_input && typeof hookInput.tool_input === 'object' ? (hookInput.tool_input as Record<string, unknown>) : {},
    toolUseId: hookInput.tool_use_id,
    author: mapper.authorForAgentId(hookInput.agent_id),
  };
}

export class ClaudeAgentSdkEngine implements AgentEngine {
  readonly name = 'claude-agent-sdk';
  readonly provider = 'claude' as const;

  constructor(
    private readonly queryFn: QueryFn = sdkQuery as QueryFn,
    private readonly getEnv?: () => Record<string, string | undefined>,
    private readonly deliveryMode: DeliveryMode = 'stream',
    private readonly sessionInfoFn: SessionInfoFn = sdkGetSessionInfo,
  ) {}

  async readSessionTitle(sessionId: string, cwd: string): Promise<string | null> {
    return pickSessionTitle(await this.sessionInfoFn(sessionId, { dir: cwd }));
  }

  startTurn(input: EngineTurnInput, cb: EngineCallbacks): EngineTurn {
    const abort = new AbortController();
    const mapper = new SdkEventMapper(input.options.agent, input.options.model === 'kit' ? null : input.options.effort);
    const emitAll = (events: ReturnType<SdkEventMapper['mapMessage']>) => {
      for (const event of events) cb.emit(event);
    };
    let interrupted = false;
    const channel = new InputChannel<SDKUserMessage>();
    const resolve = (messages: OutgoingMessage[]): Promise<SDKUserMessage[]> =>
      Promise.all(messages.map((message) => toSdkUserMessage(message, cb.readAttachment)));
    const revert = (messages: OutgoingMessage[]): void => cb.revertPending(messages.map((message) => message.id));
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
        beforeTool: cb.beforeTool
          ? (hookInput) => cb.beforeTool!(toolRunContext(hookInput, mapper))
          : undefined,
        afterTool: cb.afterTool
          ? (hookInput, outcome) => cb.afterTool!(toolRunContext(hookInput, mapper), outcome)
          : undefined,
        deliverAtCutPoint: async () => {
          if (interrupted) return {};
          if (this.deliveryMode === 'stream') {
            const messages = cb.collectPending('cut-point');
            if (messages.length === 0) return {};
            const resolved = await resolve(messages);
            if (interrupted) {
              revert(messages);
              return {};
            }
            await channel.pushAndFlush(resolved);
            return {};
          }
          const messages = cb.collectPending('cut-point', { textOnly: true });
          if (messages.length === 0) return {};
          return { hookSpecificOutput: { hookEventName: 'PostToolBatch' as const, additionalContext: toHookContext(messages) } };
        },
        onHook: (hookInput) => emitAll(mapper.mapHook(hookInput as Parameters<SdkEventMapper['mapHook']>[0])),
        canUseTool: async (toolName, toolInput, opts) => {
          const decision = await cb.requestApproval(
            { toolName, input: toolInput, author: mapper.authorForAgentId(opts.agentID), toolUseId: opts.toolUseID ?? null },
            opts.signal,
          );
          const toolUseId = opts.toolUseID;
          if (toolUseId) {
            if (decision.behavior === 'allow') cb.rebaseTool?.(toolUseId);
            else cb.cancelTool?.(toolUseId);
          }
          return decision.behavior === 'allow'
            ? { behavior: 'allow', updatedInput: decision.updatedInput ?? toolInput }
            : { behavior: 'deny', message: decision.message };
        },
      }),
    });
    const reportContextUsage = async (): Promise<void> => {
      if (!cb.onContextUsage) return;
      try {
        const usage = await withTimeout(q.getContextUsage({ detail: 'summary' }), CONTEXT_USAGE_TIMEOUT_MS);
        const usedTokens = Math.round(usage.totalTokens);
        const maxTokens = Math.round(usage.maxTokens);
        if (Number.isFinite(usedTokens) && Number.isFinite(maxTokens) && usedTokens >= 0 && maxTokens > 0) cb.onContextUsage({ usedTokens, maxTokens });
      } catch {
        // The meter is best effort: a missing reading never fails the turn.
      }
    };
    const deliverOrClose = async (result: SdkMessageLike): Promise<void> => {
      if (interrupted || mapper.sawError) {
        channel.end();
        return;
      }
      const next = cb.collectPending('turn-end');
      if (next.length === 0) {
        if (!(Number(result.queued_turn_count) > 0)) channel.end();
        return;
      }
      const resolved = await resolve(next);
      if (interrupted) revert(next);
      else channel.push(resolved);
    };
    const done = (async () => {
      try {
        const initial = await resolve(input.prompts);
        if (interrupted) revert(input.prompts);
        else channel.push(initial);
        for await (const message of q) {
          const msg = message as unknown as SdkMessageLike;
          if (msg.type === 'system' && msg.subtype === 'init' && typeof msg.session_id === 'string') {
            cb.onSessionId(msg.session_id);
          }
          emitAll(mapper.mapMessage(msg));
          if (msg.type === 'result') {
            await reportContextUsage();
            await deliverOrClose(msg);
          }
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