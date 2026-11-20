import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { MAX_MCP_LOGIN_OUTPUT_BYTES, type ClaudeMcpLoginOutcome, type ClaudeMcpLoginResult, type ClaudeMcpReconnectResult } from '@sdd-studio/protocol';
import type { ClaudeInventoryService } from './claude-inventory';

export const MCP_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export interface McpLoginRun {
  exitCode: number | null;
  output: string;
  timedOut: boolean;
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
  const require = createRequire(import.meta.url);
  const file = platform === 'win32' ? 'claude.exe' : 'claude';
  return require.resolve(`@anthropic-ai/claude-agent-sdk-${platform}-${arch}/${file}`);
};

export const trimOutput = (raw: string): string => {
  const cleaned = raw.replace(/(https?:\/\/[^\s?]+)\?\S*/g, '$1?…').trim();
  const bytes = Buffer.from(cleaned, 'utf8');
  if (bytes.length <= MAX_MCP_LOGIN_OUTPUT_BYTES) return cleaned;
  return bytes.subarray(bytes.length - MAX_MCP_LOGIN_OUTPUT_BYTES).toString('utf8').replace(/^�+/, '');
};

export const classifyLogin = (run: McpLoginRun): ClaudeMcpLoginOutcome => {
  if (run.timedOut) return 'timeout';
  if (run.exitCode === 0) return 'ok';
  if (/doesn't support OAuth login/i.test(run.output)) return 'not-oauth';
  if (/authenticates with the `?Authorization`? header/i.test(run.output)) return 'header-auth';
  if (/No MCP server named/i.test(run.output)) return 'unknown-server';
  return 'failed';
};

export const spawnLogin = (name: string, root: string, timeoutMs: number): Promise<McpLoginRun> =>
  new Promise((resolve) => {
    let binary: string;
    try {
      binary = resolveSdkBinary();
    } catch {
      resolve({ exitCode: null, output: 'the Claude engine binary was not found', timedOut: false });
      return;
    }
    const child = execFile(binary, ['mcp', 'login', name], { cwd: root, timeout: timeoutMs, maxBuffer: 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      const failure = error as (NodeJS.ErrnoException & { killed?: boolean; code?: number | string }) | null;
      const timedOut = Boolean(failure?.killed);
      const exitCode = failure === null ? 0 : typeof failure.code === 'number' ? failure.code : null;
      resolve({ exitCode, output: `${stdout}${stderr}`, timedOut });
    });
    child.stdin?.end();
  });

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
