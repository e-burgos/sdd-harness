import { describe, expect, it } from 'vitest';
import {
  ClaudeInventory,
  ClaudeToolsConfig,
  ClaudeToolsGetResult,
  ClaudeToolsSetResult,
  DEFAULT_CLAUDE_TOOLS_CONFIG,
} from './claude-tools';

const counts = { skills: 3, agents: 1, plugins: 1, mcpServers: 2, mcpTools: 10 };
const inventory = {
  capturedAt: '2026-11-20T10:00:00.000Z',
  plugins: [{ id: 'a@market', name: 'a', scope: 'user' }],
  mcpServers: [{ name: 'chrome-devtools', status: 'connected', source: 'studio' }],
  counts: { project: counts, all: counts },
};

describe('ClaudeToolsConfig', () => {
  it('parses the defaults', () => {
    expect(ClaudeToolsConfig.parse(DEFAULT_CLAUDE_TOOLS_CONFIG)).toEqual(DEFAULT_CLAUDE_TOOLS_CONFIG);
  });
  it('accepts an http browser url and rejects other values', () => {
    const base = DEFAULT_CLAUDE_TOOLS_CONFIG;
    const withUrl = (browserUrl: string) => ({ ...base, browser: { enabled: true, browserUrl } });
    expect(ClaudeToolsConfig.safeParse(withUrl('http://127.0.0.1:9222')).success).toBe(true);
    expect(ClaudeToolsConfig.safeParse(withUrl('ftp://host')).success).toBe(false);
    expect(ClaudeToolsConfig.safeParse(withUrl('not a url')).success).toBe(false);
  });
  it('rejects bad shapes and oversized lists', () => {
    const base = DEFAULT_CLAUDE_TOOLS_CONFIG;
    expect(ClaudeToolsConfig.safeParse({ ...base, sources: { user: 'yes', local: false } }).success).toBe(false);
    expect(ClaudeToolsConfig.safeParse({ ...base, disabledPlugins: Array(201).fill('a@b') }).success).toBe(false);
    expect(ClaudeToolsConfig.safeParse({ ...base, disabledMcpServers: [''] }).success).toBe(false);
    expect(ClaudeToolsConfig.safeParse({ sources: base.sources }).success).toBe(false);
  });
});

describe('ClaudeInventory', () => {
  it('parses a full inventory', () => {
    expect(ClaudeInventory.parse(inventory)).toEqual(inventory);
  });
  it('tolerates an unknown MCP status', () => {
    const parsed = ClaudeInventory.parse({
      ...inventory,
      mcpServers: [{ name: 'x', status: 'brand-new-state', source: 'user' }],
    });
    expect(parsed.mcpServers[0]?.status).toBe('unknown');
  });
  it('rejects negative counts', () => {
    const bad = { ...inventory, counts: { project: { ...counts, skills: -1 }, all: counts } };
    expect(ClaudeInventory.safeParse(bad).success).toBe(false);
  });
});

describe('results', () => {
  it('get result allows a null inventory', () => {
    const result = {
      config: DEFAULT_CLAUDE_TOOLS_CONFIG,
      revision: '0123456789abcdef',
      inventory: null,
      browserMcpVersion: '1.13.0',
    };
    expect(ClaudeToolsGetResult.parse(result)).toEqual(result);
    expect(ClaudeToolsGetResult.safeParse({ ...result, revision: 'xyz' }).success).toBe(false);
  });
  it('set result carries changed', () => {
    const result = { config: DEFAULT_CLAUDE_TOOLS_CONFIG, revision: '0123456789abcdef', changed: true };
    expect(ClaudeToolsSetResult.parse(result)).toEqual(result);
  });
});
