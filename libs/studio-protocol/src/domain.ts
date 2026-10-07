import { z } from 'zod';

export const KNOWN_AGENTS = [
  'sdd-orchestrator',
  'sdd-functional',
  'sdd-planner',
  'sdd-architect',
  'sdd-implementor-back',
  'sdd-implementor-front',
  'sdd-reviewer',
  'sdd-steward',
] as const;
export const DEFAULT_AGENT = 'sdd-orchestrator';

export const AgentId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/);
export type AgentId = z.infer<typeof AgentId>;
export const ModelChoice = z.enum(['kit', 'haiku', 'sonnet', 'opus', 'fable']);
export type ModelChoice = z.infer<typeof ModelChoice>;
export const Effort = z.enum(['low', 'medium', 'high', 'xhigh', 'max']);
export type Effort = z.infer<typeof Effort>;
export const PermissionModeChoice = z.enum(['default', 'acceptEdits', 'plan']);
export type PermissionModeChoice = z.infer<typeof PermissionModeChoice>;
export const AuthMode = z.enum(['local-claude-login', 'api-key']);
export type AuthMode = z.infer<typeof AuthMode>;

export const ChannelId = z
  .string()
  .regex(/^(general|fixes|spec:[A-Za-z0-9][A-Za-z0-9._-]{0,127}|dm:[A-Za-z0-9][A-Za-z0-9_-]{0,63})$/);
export type ChannelId = z.infer<typeof ChannelId>;

export const ThreadOptions = z.object({
  agent: AgentId,
  model: ModelChoice,
  effort: Effort.nullable(),
  permissionMode: PermissionModeChoice,
});
export type ThreadOptions = z.infer<typeof ThreadOptions>;

export const Author = z.object({ agent: z.string().min(1), parentToolUseId: z.string().nullable() });
export type Author = z.infer<typeof Author>;

export const SessionStatus = z.enum(['queued', 'running', 'waiting-approval', 'idle', 'interrupted', 'error']);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const ThreadInfo = z.object({
  id: z.string().min(1),
  channelId: ChannelId,
  title: z.string(),
  agent: AgentId,
  options: ThreadOptions,
  status: SessionStatus,
  createdAt: z.string(),
  lastActivity: z.string(),
});
export type ThreadInfo = z.infer<typeof ThreadInfo>;

export const PresenceState = z.enum(['working', 'waiting', 'open', 'idle']);
export type PresenceState = z.infer<typeof PresenceState>;
export const Presence = z.object({
  agent: z.string(),
  state: PresenceState,
  threadId: z.string().nullable(),
  specId: z.string().nullable(),
  tool: z.string().nullable(),
});
export type Presence = z.infer<typeof Presence>;

export const channelForSpec = (specId: string): string => `spec:${specId}`;
export const specIdOfChannel = (channelId: string): string | null =>
  channelId.startsWith('spec:') ? channelId.slice(5) : null;

export const channelForDm = (agent: string): string => `dm:${agent}`;
export const dmAgentOfChannel = (channelId: string): string | null =>
  channelId.startsWith('dm:') ? channelId.slice(3) : null;

export function defaultThreadOptions(agent: string = DEFAULT_AGENT): ThreadOptions {
  return { agent, model: 'kit', effort: null, permissionMode: 'default' };
}
