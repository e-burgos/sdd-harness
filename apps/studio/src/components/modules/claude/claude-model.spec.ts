import { DEFAULT_CLAUDE_TOOLS_CONFIG, type ClaudeCounts, type ClaudeInventory } from '@sdd-studio/protocol';
import {
  addedCounts,
  costWarning,
  isValidBrowserUrl,
  mcpRows,
  normalizeBrowserUrl,
  pluginRows,
  sectionOf,
  withBrowser,
  withMcpEnabled,
  withPluginEnabled,
  withSource,
} from './claude-model';

const counts = (over: Partial<ClaudeCounts> = {}): ClaudeCounts => ({ skills: 0, agents: 0, plugins: 0, mcpServers: 0, mcpTools: 0, ...over });

const inventory = (project: Partial<ClaudeCounts>, all: Partial<ClaudeCounts>): ClaudeInventory => ({
  capturedAt: '2026-11-20T10:00:00Z',
  plugins: [
    { id: 'tools@market', name: 'tools', scope: 'user' },
    { id: 'repo@market', name: 'repo', scope: 'project' },
  ],
  mcpServers: [
    { name: 'github', status: 'connected', source: 'user' },
    { name: 'docs', status: 'needs-auth', source: 'local' },
  ],
  counts: { project: counts(project), all: counts(all) },
});

const userOn = withSource(DEFAULT_CLAUDE_TOOLS_CONFIG, 'user', true);

describe('claude model', () => {
  it('derives what the extra sources add', () => {
    expect(addedCounts(inventory({ skills: 10, mcpTools: 2 }, { skills: 40, mcpTools: 12 }))).toMatchObject({ skills: 30, mcpTools: 10 });
  });

  it('warns when added skills pass 100 with a source on', () => {
    expect(costWarning(inventory({ skills: 10 }, { skills: 111 }), userOn)).toEqual({ skills: 101, mcpTools: 0 });
    expect(costWarning(inventory({ skills: 10 }, { skills: 110 }), userOn)).toBeNull();
  });

  it('warns when MCP tools pass 50 with a source on', () => {
    expect(costWarning(inventory({}, { mcpTools: 51 }), userOn)).toEqual({ skills: 0, mcpTools: 51 });
    expect(costWarning(inventory({}, { mcpTools: 50 }), userOn)).toBeNull();
    expect(costWarning(inventory({ mcpTools: 64 }, { mcpTools: 184 }), userOn)).toEqual({ skills: 0, mcpTools: 120 });
    expect(costWarning(inventory({ mcpTools: 64 }, { mcpTools: 100 }), userOn)).toBeNull();
  });

  it('does not warn without an extra source or without inventory', () => {
    expect(costWarning(inventory({}, { skills: 500, mcpTools: 500 }), DEFAULT_CLAUDE_TOOLS_CONFIG)).toBeNull();
    expect(costWarning(null, userOn)).toBeNull();
  });

  it('marks plugins off by id and ignored when their source is off', () => {
    const config = withPluginEnabled(userOn, 'tools@market', false);
    expect(pluginRows(inventory({}, {}), config)).toEqual([
      { id: 'tools@market', name: 'tools', scope: 'user', enabled: false, ignoredBySource: false },
      { id: 'repo@market', name: 'repo', scope: 'project', enabled: true, ignoredBySource: false },
    ]);
    expect(pluginRows(inventory({}, {}), DEFAULT_CLAUDE_TOOLS_CONFIG)[0]?.ignoredBySource).toBe(true);
  });

  it('shows MCP servers turned off in Studio as studio-off', () => {
    const rows = mcpRows(inventory({}, {}), withMcpEnabled(userOn, 'github', false));
    expect(rows[0]).toMatchObject({ name: 'github', enabled: false, status: 'studio-off' });
    expect(rows[1]).toMatchObject({ name: 'docs', enabled: true, status: 'needs-auth', ignoredBySource: true });
  });

  it('toggles list entries without duplicates', () => {
    const off = withMcpEnabled(withMcpEnabled(DEFAULT_CLAUDE_TOOLS_CONFIG, 'a', false), 'a', false);
    expect(off.disabledMcpServers).toEqual(['a']);
    expect(withMcpEnabled(off, 'a', true).disabledMcpServers).toEqual([]);
  });

  it('validates the browser url like the schema', () => {
    expect(isValidBrowserUrl('')).toBe(true);
    expect(isValidBrowserUrl('http://127.0.0.1:9222')).toBe(true);
    expect(isValidBrowserUrl('ws://host')).toBe(false);
    expect(isValidBrowserUrl('http://a b')).toBe(false);
    expect(isValidBrowserUrl(`http://${'a'.repeat(200)}`)).toBe(false);
    expect(normalizeBrowserUrl('  ')).toBeNull();
    expect(normalizeBrowserUrl(' http://x:1 ')).toBe('http://x:1');
    expect(withBrowser(DEFAULT_CLAUDE_TOOLS_CONFIG, { enabled: true }).browser).toEqual({ enabled: true, browserUrl: null });
  });

  it('falls back to the first section for unknown selections', () => {
    expect(sectionOf('mcp')).toBe('mcp');
    expect(sectionOf('x')).toBe('sources');
    expect(sectionOf(null)).toBe('sources');
  });
});
