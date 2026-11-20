import type { ClaudeCounts, ClaudeInventory, ClaudeMcpStatus, ClaudeToolsConfig } from '@sdd-studio/protocol';

export const CLAUDE_SECTIONS = ['sources', 'plugins', 'mcp', 'browser'] as const;
export type ClaudeSection = (typeof CLAUDE_SECTIONS)[number];

export const DEFAULT_CLAUDE_SECTION: ClaudeSection = 'sources';

export const COST_THRESHOLDS = { skills: 100, mcpTools: 50 } as const;

const BROWSER_URL_PATTERN = /^https?:\/\/\S+$/;
const BROWSER_URL_MAX = 200;

export interface CostWarning {
  skills: number;
  mcpTools: number;
}

export interface PluginRow {
  id: string;
  name: string;
  scope: string;
  enabled: boolean;
  ignoredBySource: boolean;
}

export type McpDisplayStatus = ClaudeMcpStatus | 'studio-off';

export interface McpRow {
  name: string;
  source: string;
  status: McpDisplayStatus;
  enabled: boolean;
  ignoredBySource: boolean;
}

export const sectionOf = (value: string | null): ClaudeSection => (CLAUDE_SECTIONS as readonly string[]).includes(value ?? '') ? (value as ClaudeSection) : DEFAULT_CLAUDE_SECTION;

export const addedCounts = (inventory: ClaudeInventory): ClaudeCounts => ({
  skills: inventory.counts.all.skills - inventory.counts.project.skills,
  agents: inventory.counts.all.agents - inventory.counts.project.agents,
  plugins: inventory.counts.all.plugins - inventory.counts.project.plugins,
  mcpServers: inventory.counts.all.mcpServers - inventory.counts.project.mcpServers,
  mcpTools: inventory.counts.all.mcpTools - inventory.counts.project.mcpTools,
});

export const costWarning = (inventory: ClaudeInventory | null, config: ClaudeToolsConfig): CostWarning | null => {
  if (!inventory || !(config.sources.user || config.sources.local)) return null;
  const added = addedCounts(inventory);
  const total = inventory.counts.all;
  if (added.skills <= COST_THRESHOLDS.skills && total.mcpTools <= COST_THRESHOLDS.mcpTools) return null;
  return { skills: added.skills, mcpTools: total.mcpTools };
};

const ignoredBySource = (origin: string, config: ClaudeToolsConfig): boolean =>
  (origin === 'user' && !config.sources.user) || (origin === 'local' && !config.sources.local);

export const pluginRows = (inventory: ClaudeInventory | null, config: ClaudeToolsConfig): PluginRow[] =>
  (inventory?.plugins ?? []).map((plugin) => ({
    id: plugin.id,
    name: plugin.name,
    scope: plugin.scope,
    enabled: !config.disabledPlugins.includes(plugin.id),
    ignoredBySource: ignoredBySource(plugin.scope, config),
  }));

export const mcpRows = (inventory: ClaudeInventory | null, config: ClaudeToolsConfig): McpRow[] =>
  (inventory?.mcpServers ?? []).map((server) => {
    const enabled = !config.disabledMcpServers.includes(server.name);
    return {
      name: server.name,
      source: server.source,
      enabled,
      status: enabled ? server.status : 'studio-off',
      ignoredBySource: ignoredBySource(server.source, config),
    };
  });

export const withListed = (list: readonly string[], name: string, listed: boolean): string[] => {
  const rest = list.filter((entry) => entry !== name);
  return listed ? [...rest, name] : rest;
};

export const withPluginEnabled = (config: ClaudeToolsConfig, id: string, enabled: boolean): ClaudeToolsConfig => ({
  ...config,
  disabledPlugins: withListed(config.disabledPlugins, id, !enabled),
});

export const withMcpEnabled = (config: ClaudeToolsConfig, name: string, enabled: boolean): ClaudeToolsConfig => ({
  ...config,
  disabledMcpServers: withListed(config.disabledMcpServers, name, !enabled),
});

export const withSource = (config: ClaudeToolsConfig, source: 'user' | 'local', on: boolean): ClaudeToolsConfig => ({
  ...config,
  sources: { ...config.sources, [source]: on },
});

export const withBrowser = (config: ClaudeToolsConfig, browser: Partial<ClaudeToolsConfig['browser']>): ClaudeToolsConfig => ({
  ...config,
  browser: { ...config.browser, ...browser },
});

export const isValidBrowserUrl = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed === '' || (trimmed.length <= BROWSER_URL_MAX && BROWSER_URL_PATTERN.test(trimmed));
};

export const normalizeBrowserUrl = (value: string): string | null => (value.trim() === '' ? null : value.trim());

export const rowCount = (section: ClaudeSection, inventory: ClaudeInventory | null): number | undefined => {
  if (section === 'plugins') return inventory?.plugins.length;
  if (section === 'mcp') return inventory?.mcpServers.length;
  return undefined;
};
