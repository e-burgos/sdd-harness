import type { Author, ThreadEvent, ThreadOptions } from '@sdd-studio/protocol';

export type PromptBlock = { kind: 'text'; text: string };

export interface TurnPrompt {
  text: string;
  preamble: string[];
  blocks: PromptBlock[];
}

export interface OutgoingMessage {
  id: string;
  prompt: TurnPrompt;
}

export const plainPrompt = (text: string): TurnPrompt => ({ text, preamble: [], blocks: [] });

export interface EngineTurnInput {
  threadId: string;
  text: string;
  options: ThreadOptions;
  resumeSessionId: string | null;
  cwd: string;
}

export interface ApprovalRequest {
  toolName: string;
  input: Record<string, unknown>;
  author: Author;
  toolUseId: string | null;
}

export type ApprovalDecision = { behavior: 'allow' } | { behavior: 'deny'; message: string };

export type ToolVerdict = { kind: 'allow' } | { kind: 'warn'; reason: string } | { kind: 'deny'; reason: string };

export interface JudgeContext {
  author: Author;
  toolUseId: string | null;
}

export interface EngineCallbacks {
  emit(event: ThreadEvent): void;
  /**
   * Synchronous SPEC GATE check, independent of the permission mode and of `permissions.allow` rules:
   * engines call it before every tool use (SDK: PreToolUse hook). On deny the implementation already
   * announced the denial (approval.requested + approval.resolved deny).
   */
  judgeTool(toolName: string, input: Record<string, unknown>, ctx?: JudgeContext): ToolVerdict;
  onSessionId(id: string): void;
  requestApproval(request: ApprovalRequest, signal: AbortSignal): Promise<ApprovalDecision>;
}

export interface EngineTurn {
  done: Promise<void>;
  interrupt(): Promise<void>;
}

/** Engine boundary: the web app and the SessionManager never see SDK types. */
export interface AgentEngine {
  readonly name: string;
  startTurn(input: EngineTurnInput, callbacks: EngineCallbacks): EngineTurn;
}
