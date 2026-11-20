import type { EngineInitInfo } from './types';
import type { SdkMessageLike } from './sdk-mapper';

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});
const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

export function deriveInitInfo(msg: SdkMessageLike): EngineInitInfo {
  const raw = msg as Record<string, unknown>;
  const plugins = asArray(raw.plugins).flatMap((entry) => {
    const record = asRecord(entry);
    const id = asText(record.source);
    if (!id) return [];
    const at = id.lastIndexOf('@');
    return [{ id, name: asText(record.name) || id, scope: at >= 0 ? id.slice(at + 1) : 'unknown' }];
  });
  const mcpServers = asArray(raw.mcp_servers).flatMap((entry) => {
    const record = asRecord(entry);
    const name = asText(record.name);
    if (!name) return [];
    return [{ name, status: asText(record.status) || 'unknown', source: asText(record.source) || 'unknown' }];
  });
  const tools = asArray(raw.tools);
  return {
    plugins,
    mcpServers,
    counts: {
      skills: asArray(raw.skills).length,
      agents: asArray(raw.agents).length,
      plugins: plugins.length,
      mcpServers: mcpServers.length,
      mcpTools: tools.filter((tool) => typeof tool === 'string' && tool.startsWith('mcp__')).length,
    },
  };
}
