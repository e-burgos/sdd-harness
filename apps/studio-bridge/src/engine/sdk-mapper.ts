import type { Author, Effort, ThreadEvent } from '@sdd-studio/protocol';
import { diffFor, summarizeTool, truncate } from './tool-summary';

type Block = { type: string; [key: string]: unknown };
export type SdkMessageLike = { type: string; subtype?: string; [key: string]: unknown };

const AGENT_TOOLS = new Set(['Agent', 'Task']);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function resultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return (content as Block[]).map((b) => (b.type === 'text' ? str(b.text) : '')).join('\n');
}

/** Traduce el stream del Agent SDK a eventos del protocolo. Sin dependencias del SDK. */
export class SdkEventMapper {
  sessionId: string | null = null;
  private errorSeen = false;
  private lastTotalCost = 0;
  private model: string | null = null;
  private counter = 0;
  private readonly subagentByToolUse = new Map<string, string>();
  private readonly subagentById = new Map<string, string>();

  constructor(
    private readonly mainAgent: string,
    private readonly effort: Effort | null,
  ) {}

  /** true once a result carried an error status (the real iterator may then throw). */
  get sawError(): boolean {
    return this.errorSeen;
  }

  mapMessage(msg: SdkMessageLike): ThreadEvent[] {
    switch (msg.type) {
      case 'system':
        if (msg.subtype === 'init') {
          this.sessionId = str(msg.session_id) || null;
          this.model = str(msg.model) || null;
        }
        return [];
      case 'assistant':
        return this.mapAssistant(msg);
      case 'user':
        return this.mapUser(msg);
      case 'result':
        return this.mapResult(msg);
      default:
        return [];
    }
  }

  mapHook(input: { hook_event_name?: unknown; agent_id?: unknown; agent_type?: unknown }): ThreadEvent[] {
    const agentId = str(input.agent_id);
    const agentType = str(input.agent_type) || 'subagent';
    if (!agentId) return [];
    if (input.hook_event_name === 'SubagentStart') {
      this.subagentById.set(agentId, agentType);
      return [{ type: 'subagent.start', agentId, agentType }];
    }
    if (input.hook_event_name === 'SubagentStop') {
      this.subagentById.delete(agentId);
      return [{ type: 'subagent.stop', agentId, agentType }];
    }
    return [];
  }

  authorForAgentId(agentId: string | undefined): Author {
    if (agentId) return { agent: this.subagentById.get(agentId) ?? 'subagent', parentToolUseId: null };
    return { agent: this.mainAgent, parentToolUseId: null };
  }

  private authorFor(parent: unknown): Author {
    if (typeof parent === 'string' && parent) {
      return { agent: this.subagentByToolUse.get(parent) ?? 'subagent', parentToolUseId: parent };
    }
    return { agent: this.mainAgent, parentToolUseId: null };
  }

  private mapAssistant(msg: SdkMessageLike): ThreadEvent[] {
    const author = this.authorFor(msg.parent_tool_use_id);
    const message = (msg.message ?? {}) as { id?: unknown; content?: unknown };
    const blocks = Array.isArray(message.content) ? (message.content as Block[]) : [];
    const baseId = str(message.id) || `m${++this.counter}`;
    const out: ThreadEvent[] = [];
    blocks.forEach((block, index) => {
      if (block.type === 'text' && str(block.text).trim()) {
        const messageId = `${baseId}:${index}`;
        out.push(
          { type: 'message.start', messageId, author },
          { type: 'message.delta', messageId, text: str(block.text) },
          { type: 'message.end', messageId },
        );
      } else if (block.type === 'tool_use' && str(block.id) && str(block.name)) {
        const name = str(block.name);
        const input = (block.input && typeof block.input === 'object' ? block.input : {}) as Record<string, unknown>;
        if (AGENT_TOOLS.has(name)) this.subagentByToolUse.set(str(block.id), str(input.subagent_type) || 'general-purpose');
        const diff = diffFor(name, input);
        out.push({
          type: 'tool.start',
          toolUseId: str(block.id),
          author,
          tool: name,
          summary: summarizeTool(name, input),
          ...(diff ? { diff } : {}),
        });
      }
    });
    return out;
  }

  private mapUser(msg: SdkMessageLike): ThreadEvent[] {
    const message = (msg.message ?? {}) as { content?: unknown };
    if (!Array.isArray(message.content)) return [];
    return (message.content as Block[])
      .filter((b) => b.type === 'tool_result' && str(b.tool_use_id))
      .map((b) => ({
        type: 'tool.end' as const,
        toolUseId: str(b.tool_use_id),
        isError: b.is_error === true,
        summary: truncate(resultText(b.content), 200),
      }));
  }

  private mapResult(msg: SdkMessageLike): ThreadEvent[] {
    const usage = (msg.usage ?? {}) as Record<string, unknown>;
    // total_cost_usd is cumulative across the query; report the delta per result.
    const total = num(msg.total_cost_usd);
    const costUsd = Math.max(0, total - this.lastTotalCost);
    this.lastTotalCost = total;
    const out: ThreadEvent[] = [
      {
        type: 'turn.end',
        usage: {
          model: this.primaryModel(msg.modelUsage),
          effort: this.effort,
          tokensIn: num(usage.input_tokens) + num(usage.cache_read_input_tokens) + num(usage.cache_creation_input_tokens),
          tokensOut: num(usage.output_tokens),
          costUsd,
        },
      },
    ];
    if (msg.subtype !== 'success' || msg.is_error === true) {
      this.errorSeen = true;
      const errors = Array.isArray(msg.errors) ? msg.errors.filter((e): e is string => typeof e === 'string') : [];
      out.push({
        type: 'session.status',
        status: 'error',
        error: {
          code: str(msg.subtype) || 'error',
          message: truncate(errors.join('; ') || str(msg.result) || str(msg.subtype) || 'error', 500),
        },
      });
    }
    return out;
  }

  private primaryModel(modelUsage: unknown): string {
    let best: { name: string; cost: number } | null = null;
    if (modelUsage && typeof modelUsage === 'object') {
      for (const [name, value] of Object.entries(modelUsage as Record<string, { costUSD?: unknown }>)) {
        const cost = num(value?.costUSD);
        if (!best || cost > best.cost) best = { name, cost };
      }
    }
    return best?.name ?? this.model ?? 'unknown';
  }
}