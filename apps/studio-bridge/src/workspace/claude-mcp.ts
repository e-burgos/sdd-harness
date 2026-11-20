import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { MAX_MCP_LOGIN_OUTPUT_BYTES, type ClaudeMcpLoginOutcome, type ClaudeMcpLoginResult, type ClaudeMcpReconnectResult } from '@sdd-studio/protocol';
import type { ClaudeInventoryService } from './claude-inventory';

export const MCP_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export interface McpLoginRun {
  exitCode: number | null;
  output: string;
  timedOut: boolean;
  terminal?: boolean;
}

export interface ClaudeMcpDeps {
  root: string;
  inventory: Pick<ClaudeInventoryService, 'refresh'>;
  runLogin?: (name: string, root: string, timeoutMs: number) => Promise<McpLoginRun>;
  timeoutMs?: number;
}

export interface ClaudeMcpService {
  login(name: string): Promise<ClaudeMcpLoginResult>;
  reconnect(name: string): Promise<ClaudeMcpReconnectResult>;
}

export const resolveSdkBinary = (platform: NodeJS.Platform = process.platform, arch: string = process.arch): string => {
  // The platform package is a dependency of the SDK, not of the bridge: strict installs (pnpm) only expose it from the SDK.
  const sdkRequire = createRequire(createRequire(import.meta.url).resolve('@anthropic-ai/claude-agent-sdk'));
  const file = platform === 'win32' ? 'claude.exe' : 'claude';
  return sdkRequire.resolve(`@anthropic-ai/claude-agent-sdk-${platform}-${arch}/${file}`);
};

const ANSI_PATTERN = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;

export const stripAnsi = (raw: string): string => raw.replace(ANSI_PATTERN, '').replace(/\r\n?/g, '\n');

export const trimOutput = (raw: string): string => {
  const cleaned = stripAnsi(raw)
    .replace(/(https?:\/\/[^\s?]+)\?\S*/g, '$1?…')
    .trim();
  const bytes = Buffer.from(cleaned, 'utf8');
  if (bytes.length <= MAX_MCP_LOGIN_OUTPUT_BYTES) return cleaned;
  return bytes.subarray(bytes.length - MAX_MCP_LOGIN_OUTPUT_BYTES).toString('utf8').replace(/^�+/, '');
};

export const classifyLogin = (run: McpLoginRun): ClaudeMcpLoginOutcome => {
  if (run.terminal) return 'terminal';
  if (run.timedOut) return 'timeout';
  if (run.exitCode === 0) return 'ok';
  if (/doesn't support OAuth login/i.test(run.output)) return 'not-oauth';
  if (/authenticates with the `?Authorization`? header/i.test(run.output)) return 'header-auth';
  if (/No MCP server named/i.test(run.output)) return 'unknown-server';
  return 'failed';
};

export const PTY_WRAPPER_SCRIPT = 'import pty,sys; sys.exit(pty.spawn(sys.argv[1:]) >> 8)';

export const MCP_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:@/-]*$/;

export interface Invocation {
  command: string;
  args: string[];
}

export const ptyInvocation = (binary: string, name: string): Invocation => ({
  command: 'python3',
  args: ['-c', PTY_WRAPPER_SCRIPT, binary, 'mcp', 'login', name],
});

const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

export const terminalInvocation = (binary: string, name: string, platform: NodeJS.Platform): Invocation => {
  if (platform === 'darwin') {
    const command = `${shellQuote(binary)} mcp login ${shellQuote(name)}`.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return { command: 'osascript', args: ['-e', `tell application "Terminal" to do script "${command}"`] };
  }
  if (platform === 'win32') {
    return { command: 'cmd', args: ['/c', 'start', '', 'cmd', '/k', `"${binary}"`, 'mcp', 'login', name] };
  }
  return { command: 'x-terminal-emulator', args: ['-e', binary, 'mcp', 'login', name] };
};

export interface SpawnLoginDeps {
  platform: NodeJS.Platform;
  resolveBinary: () => string;
  hasPython: () => Promise<boolean>;
  execFile: typeof execFile;
}

let pythonAvailable: Promise<boolean> | null = null;

export const detectPython = (): Promise<boolean> => {
  pythonAvailable ??= new Promise<boolean>((resolve) => {
    execFile('python3', ['--version'], { windowsHide: true }, (error) => resolve(error === null));
  });
  return pythonAvailable;
};

const defaultSpawnDeps = (): SpawnLoginDeps => ({ platform: process.platform, resolveBinary: resolveSdkBinary, hasPython: detectPython, execFile });

const openTerminal = (invocation: Invocation, deps: SpawnLoginDeps, root: string): Promise<McpLoginRun> =>
  new Promise((resolve) => {
    deps.execFile(invocation.command, invocation.args, { cwd: root, windowsHide: false }, (error, stdout, stderr) => {
      resolve(error === null ? { exitCode: 0, output: '', timedOut: false, terminal: true } : { exitCode: null, output: `${stdout}${stderr}`, timedOut: false });
    });
  });

const runUnderPty = (invocation: Invocation, deps: SpawnLoginDeps, root: string, timeoutMs: number): Promise<McpLoginRun> =>
  new Promise((resolve) => {
    deps.execFile(invocation.command, invocation.args, { cwd: root, timeout: timeoutMs, maxBuffer: 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      const failure = error as (NodeJS.ErrnoException & { killed?: boolean; code?: number | string }) | null;
      const timedOut = Boolean(failure?.killed);
      const exitCode = failure === null ? 0 : typeof failure.code === 'number' ? failure.code : null;
      resolve({ exitCode, output: `${stdout}${stderr}`, timedOut });
    });
  });

export const spawnLogin = async (name: string, root: string, timeoutMs: number, overrides: Partial<SpawnLoginDeps> = {}): Promise<McpLoginRun> => {
  const deps = { ...defaultSpawnDeps(), ...overrides };
  let binary: string;
  try {
    binary = deps.resolveBinary();
  } catch {
    return { exitCode: null, output: 'the Claude engine binary was not found', timedOut: false };
  }
  if (deps.platform !== 'win32' && (await deps.hasPython())) return runUnderPty(ptyInvocation(binary, name), deps, root, timeoutMs);
  if (!MCP_NAME_PATTERN.test(name)) return { exitCode: null, output: 'invalid MCP server name', timedOut: false };
  return openTerminal(terminalInvocation(binary, name, deps.platform), deps, root);
};

export function createClaudeMcp(deps: ClaudeMcpDeps): ClaudeMcpService {
  const runLogin = deps.runLogin ?? spawnLogin;
  const timeoutMs = deps.timeoutMs ?? MCP_LOGIN_TIMEOUT_MS;
  const inflight = new Map<string, Promise<ClaudeMcpLoginResult>>();

  const doLogin = async (name: string): Promise<ClaudeMcpLoginResult> => {
    const run = await runLogin(name, deps.root, timeoutMs);
    const outcome = classifyLogin(run);
    const inventory = outcome === 'ok' ? await deps.inventory.refresh().catch(() => null) : null;
    return { name, outcome, output: trimOutput(run.output), inventory };
  };

  return {
    login: (name) => {
      const existing = inflight.get(name);
      if (existing) return existing;
      const started = doLogin(name).finally(() => inflight.delete(name));
      inflight.set(name, started);
      return started;
    },
    reconnect: async (name) => {
      const inventory = await deps.inventory.refresh();
      const server = inventory.mcpServers.find((entry) => entry.name === name);
      return { name, status: server?.status ?? null, inventory };
    },
  };
}
