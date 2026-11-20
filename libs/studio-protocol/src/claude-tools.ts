import { z } from 'zod';
import { ToolsRevision } from './snapshot';

const MAX_LIST_ITEMS = 200;
const Name = z.string().min(1).max(200);

export const ClaudeToolsConfig = z.object({
  sources: z.object({ user: z.boolean(), local: z.boolean() }),
  disabledPlugins: z.array(Name).max(MAX_LIST_ITEMS),
  disabledMcpServers: z.array(Name).max(MAX_LIST_ITEMS),
  browser: z.object({
    enabled: z.boolean(),
    browserUrl: z.string().max(200).regex(/^https?:\/\/\S+$/).nullable(),
  }),
});
export type ClaudeToolsConfig = z.infer<typeof ClaudeToolsConfig>;

export const DEFAULT_CLAUDE_TOOLS_CONFIG: ClaudeToolsConfig = {
  sources: { user: false, local: false },
  disabledPlugins: [],
  disabledMcpServers: [],
  browser: { enabled: false, browserUrl: null },
};

export const ClaudeToolsRevision = ToolsRevision;
export type ClaudeToolsRevision = z.infer<typeof ClaudeToolsRevision>;

export const CLAUDE_MCP_STATUSES = ['connected', 'needs-auth', 'failed', 'pending', 'disabled', 'unknown'] as const;
export const ClaudeMcpStatus = z.enum(CLAUDE_MCP_STATUSES).catch('unknown');
export type ClaudeMcpStatus = z.infer<typeof ClaudeMcpStatus>;

const Count = z.number().int().nonnegative();
const ClaudeCounts = z.object({
  skills: Count,
  agents: Count,
  plugins: Count,
  mcpServers: Count,
  mcpTools: Count,
});
export type ClaudeCounts = z.infer<typeof ClaudeCounts>;

export const ClaudeInventory = z.object({
  capturedAt: z.string().max(40),
  plugins: z.array(z.object({ id: Name, name: Name, scope: z.string().max(64) })).max(MAX_LIST_ITEMS),
  mcpServers: z
    .array(z.object({ name: Name, status: ClaudeMcpStatus, source: z.string().max(64) }))
    .max(MAX_LIST_ITEMS),
  counts: z.object({ project: ClaudeCounts, all: ClaudeCounts }),
});
export type ClaudeInventory = z.infer<typeof ClaudeInventory>;

export const ClaudeToolsGetResult = z.object({
  config: ClaudeToolsConfig,
  revision: ClaudeToolsRevision,
  inventory: ClaudeInventory.nullable(),
  browserMcpVersion: z.string().max(40),
});
export type ClaudeToolsGetResult = z.infer<typeof ClaudeToolsGetResult>;

export const ClaudeToolsSetResult = z.object({
  config: ClaudeToolsConfig,
  revision: ClaudeToolsRevision,
  changed: z.boolean(),
});
export type ClaudeToolsSetResult = z.infer<typeof ClaudeToolsSetResult>;

export const ClaudeInventoryRefreshResult = z.object({ inventory: ClaudeInventory });
export type ClaudeInventoryRefreshResult = z.infer<typeof ClaudeInventoryRefreshResult>;
