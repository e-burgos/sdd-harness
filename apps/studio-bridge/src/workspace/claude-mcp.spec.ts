import { existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { classifyLogin, createClaudeMcp, PTY_WRAPPER_SCRIPT, resolveSdkBinary, spawnLogin, stripAnsi, terminalInvocation, trimOutput, type McpLoginRun, type SpawnLoginDeps } from './claude-mcp';

describe('resolveSdkBinary', () => {
  it('finds the engine binary of the installed SDK for this platform', () => {
    expect(existsSync(resolveSdkBinary())).toBe(true);
  });
});

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
    [{ exitCode: 0, output: '', timedOut: false, terminal: true }, 'terminal'],
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

describe('stripAnsi', () => {
  it('removes CSI and OSC sequences and normalizes line endings', () => {
    expect(stripAnsi('\x1b[32mAuthenticated\x1b[0m with \x1b]8;;https://a.test\x07link\x1b]8;;\x07\r\n')).toBe('Authenticated with link\n');
    expect(trimOutput('\x1b[1mhi\x1b[0m')).toBe('hi');
  });
});

describe('terminalInvocation', () => {
  it('opens Terminal through osascript on macOS with escaped arguments', () => {
    const { command, args } = terminalInvocation("/a b/it's/claude", 'plugin:ops:notion', 'darwin');
    expect(command).toBe('osascript');
    expect(args).toEqual(['-e', `tell application "Terminal" to do script "'/a b/it'\\\\''s/claude' mcp login 'plugin:ops:notion'"`]);
  });
  it('uses x-terminal-emulator on Linux and cmd start on Windows', () => {
    expect(terminalInvocation('/bin/claude', 'docs', 'linux')).toEqual({ command: 'x-terminal-emulator', args: ['-e', '/bin/claude', 'mcp', 'login', 'docs'] });
    expect(terminalInvocation('C:\\c\\claude.exe', 'docs', 'win32')).toEqual({ command: 'cmd', args: ['/c', 'start', '', 'cmd', '/k', '"C:\\c\\claude.exe"', 'mcp', 'login', 'docs'] });
  });
});

describe('spawnLogin', () => {
  const harness = (overrides: Partial<SpawnLoginDeps>, result: { error?: Error & { code?: number }; stdout?: string } = {}) => {
    const end = vi.fn();
    const exec = vi.fn((_c: string, _a: string[], _o: unknown, cb: (e: Error | null, so: string, se: string) => void) => {
      cb(result.error ?? null, result.stdout ?? '', '');
      return { stdin: { end } };
    });
    const deps: Partial<SpawnLoginDeps> = { platform: 'darwin', resolveBinary: () => '/bin/claude', hasPython: async () => true, execFile: exec as unknown as SpawnLoginDeps['execFile'], ...overrides };
    return { end, exec, run: () => spawnLogin('docs', '/r', 99, deps) };
  };

  it('runs the login under the python pty wrapper and keeps stdin open', async () => {
    const { exec, end, run } = harness({}, { stdout: '\x1b[32mAuthenticated with "docs"\x1b[0m' });
    const result = await run();
    expect(exec.mock.calls[0].slice(0, 2)).toEqual(['python3', ['-c', PTY_WRAPPER_SCRIPT, '/bin/claude', 'mcp', 'login', 'docs']]);
    expect(exec.mock.calls[0][2]).toMatchObject({ cwd: '/r', timeout: 99 });
    expect(end).not.toHaveBeenCalled();
    expect(result).toMatchObject({ exitCode: 0, timedOut: false });
    expect(trimOutput(result.output)).toBe('Authenticated with "docs"');
  });
  it('reports the exit code of a failed pty login', async () => {
    const { run } = harness({}, { error: Object.assign(new Error('x'), { code: 1 }) });
    expect(await run()).toMatchObject({ exitCode: 1 });
  });
  it('opens a system terminal without python3', async () => {
    const { exec, run } = harness({ hasPython: async () => false });
    const result = await run();
    expect(exec.mock.calls[0][0]).toBe('osascript');
    expect(classifyLogin(result)).toBe('terminal');
  });
  it('never uses python on Windows', async () => {
    const { exec, run } = harness({ platform: 'win32' });
    await run();
    expect(exec.mock.calls[0][0]).toBe('cmd');
  });
  it('refuses to open a terminal for an invalid name', async () => {
    const { exec } = harness({ hasPython: async () => false });
    const result = await spawnLogin('a; rm -rf /', '/r', 1, { platform: 'linux', resolveBinary: () => '/b', hasPython: async () => false, execFile: exec as unknown as SpawnLoginDeps['execFile'] });
    expect(exec).not.toHaveBeenCalled();
    expect(classifyLogin(result)).toBe('failed');
  });
});
