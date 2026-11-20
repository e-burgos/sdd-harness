import { describe, expect, it, vi } from 'vitest';
import { classifyLogin, createClaudeMcp, trimOutput, type McpLoginRun } from './claude-mcp';

const inventory = {
  capturedAt: '2026-11-20T10:00:00.000Z',
  plugins: [],
  mcpServers: [{ name: 'docs', status: 'connected' as const, source: 'user' }],
  counts: {
    project: { skills: 0, agents: 0, plugins: 0, mcpServers: 1, mcpTools: 0 },
    all: { skills: 0, agents: 0, plugins: 0, mcpServers: 1, mcpTools: 0 },
  },
};

const service = (run: McpLoginRun, extra: Partial<Parameters<typeof createClaudeMcp>[0]> = {}) => {
  const refresh = vi.fn(async () => inventory);
  const runLogin = vi.fn(async () => run);
  return { refresh, runLogin, mcp: createClaudeMcp({ root: '/r', inventory: { refresh }, runLogin, ...extra }) };
};

describe('classifyLogin', () => {
  it.each([
    [{ exitCode: 0, output: '', timedOut: false }, 'ok'],
    [{ exitCode: 1, output: "Server docs doesn't support OAuth login", timedOut: false }, 'not-oauth'],
    [{ exitCode: 1, output: 'It authenticates with the `Authorization` header', timedOut: false }, 'header-auth'],
    [{ exitCode: 1, output: 'No MCP server named "x"', timedOut: false }, 'unknown-server'],
    [{ exitCode: 1, output: 'boom', timedOut: false }, 'failed'],
    [{ exitCode: null, output: '', timedOut: true }, 'timeout'],
  ] as const)('maps %j to %s', (run, outcome) => {
    expect(classifyLogin(run)).toBe(outcome);
  });
});

describe('trimOutput', () => {
  it('drops url queries and keeps the last 4 KiB', () => {
    expect(trimOutput('open https://a.test/auth?token=secret&x=1 now')).toBe('open https://a.test/auth?… now');
    expect(Buffer.byteLength(trimOutput('x'.repeat(10_000)))).toBeLessThanOrEqual(4096);
  });
});

describe('createClaudeMcp', () => {
  it('login ok refreshes the inventory and passes name, root and timeout', async () => {
    const { mcp, refresh, runLogin } = service({ exitCode: 0, output: 'Logged in', timedOut: false }, { timeoutMs: 123 });
    const result = await mcp.login('docs');
    expect(result).toEqual({ name: 'docs', outcome: 'ok', output: 'Logged in', inventory });
    expect(runLogin).toHaveBeenCalledWith('docs', '/r', 123);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('login failure does not refresh and returns the trimmed output', async () => {
    const { mcp, refresh } = service({ exitCode: 1, output: 'No MCP server named "docs"', timedOut: false });
    expect(await mcp.login('docs')).toMatchObject({ outcome: 'unknown-server', output: 'No MCP server named "docs"', inventory: null });
    expect(refresh).not.toHaveBeenCalled();
  });
  it('reports timeout', async () => {
    const { mcp } = service({ exitCode: null, output: '', timedOut: true });
    expect((await mcp.login('docs')).outcome).toBe('timeout');
  });
  it('reuses the promise for the same name and allows a new login after it settles', async () => {
    const { mcp, runLogin } = service({ exitCode: 1, output: 'x', timedOut: false });
    const [a, b] = [mcp.login('docs'), mcp.login('docs')];
    expect(a).toBe(b);
    await a;
    await mcp.login('docs');
    expect(runLogin).toHaveBeenCalledTimes(2);
  });
  it('reconnect probes and reports the server status, or null when absent', async () => {
    const { mcp, refresh } = service({ exitCode: 0, output: '', timedOut: false });
    expect(await mcp.reconnect('docs')).toEqual({ name: 'docs', status: 'connected', inventory });
    expect((await mcp.reconnect('ghost')).status).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
