import { spawn } from 'node:child_process';
import type { Preflight } from '@sdd-studio/protocol';
import { buildCliEnv } from './cli-env';

export const PREFLIGHT_COMMAND_TIMEOUT_MS = 5_000;
export const REGISTRY_PROBE_TIMEOUT_MS = 3_000;

const COMMANDS = {
  pnpmVersion: { file: 'pnpm', args: ['--version'], line: 'pnpm --version' },
  pnpmRegistry: { file: 'pnpm', args: ['config', 'get', 'registry'], line: 'pnpm config get registry' },
  gitVersion: { file: 'git', args: ['--version'], line: 'git --version' },
  gitUserName: { file: 'git', args: ['config', 'user.name'], line: 'git config user.name' },
  gitUserEmail: { file: 'git', args: ['config', 'user.email'], line: 'git config user.email' },
} as const;

export type PreflightCommand = keyof typeof COMMANDS;

export interface CommandResult {
  code: number | null;
  stdout: string;
}

export type RunPreflightCommand = (command: PreflightCommand) => Promise<CommandResult>;

export function createCommandRunner(o: { env: NodeJS.ProcessEnv; platform: NodeJS.Platform; timeoutMs?: number }): RunPreflightCommand {
  const timeoutMs = o.timeoutMs ?? PREFLIGHT_COMMAND_TIMEOUT_MS;
  const env = buildCliEnv(o.env);
  return (command) =>
    new Promise((resolve) => {
      const { file, args, line } = COMMANDS[command];
      // win32 resolves pnpm.cmd only through a shell; the command line is a constant, never client input.
      const useShell = o.platform === 'win32' && file === 'pnpm';
      const child = useShell
        ? spawn(line, { shell: true, env, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
        : spawn(file, [...args], { shell: false, env, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
      let stdout = '';
      child.stdout.on('data', (chunk: Buffer) => {
        if (stdout.length < 4096) stdout += chunk.toString('utf8');
      });
      const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
      child.once('error', () => {
        clearTimeout(timer);
        resolve({ code: null, stdout: '' });
      });
      child.once('close', (code) => {
        clearTimeout(timer);
        resolve({ code, stdout });
      });
    });
}

export async function probeRegistry(url: string, timeoutMs = REGISTRY_PROBE_TIMEOUT_MS): Promise<boolean> {
  try {
    await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(timeoutMs) });
    return true;
  } catch {
    return false;
  }
}

const firstLine = (stdout: string) => stdout.split(/\r?\n/, 1)[0]!.trim();

const httpUrlOrNull = (raw: string): string | null => {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

export async function runPreflight(o: {
  run: RunPreflightCommand;
  probe?: (url: string) => Promise<boolean>;
  nodeVersion?: string;
}): Promise<Preflight> {
  const probe = o.probe ?? probeRegistry;
  const [pnpmVersion, pnpmRegistry, gitVersion, gitName, gitEmail] = await Promise.all([
    o.run('pnpmVersion'),
    o.run('pnpmRegistry'),
    o.run('gitVersion'),
    o.run('gitUserName'),
    o.run('gitUserEmail'),
  ]);

  const pnpmFound = pnpmVersion.code === 0 && firstLine(pnpmVersion.stdout) !== '';
  const registryUrl = pnpmFound && pnpmRegistry.code === 0 ? httpUrlOrNull(firstLine(pnpmRegistry.stdout)) : null;
  const reachable: Preflight['registry']['reachable'] = registryUrl === null ? 'unknown' : (await probe(registryUrl)) ? 'yes' : 'no';

  return {
    node: { version: o.nodeVersion ?? process.versions.node },
    pnpm: { found: pnpmFound, version: pnpmFound ? firstLine(pnpmVersion.stdout).slice(0, 40) : null },
    git: {
      found: gitVersion.code === 0,
      identity: gitName.code === 0 && firstLine(gitName.stdout) !== '' && gitEmail.code === 0 && firstLine(gitEmail.stdout) !== '',
    },
    registry: { url: registryUrl?.slice(0, 512) ?? null, reachable },
    ready: pnpmFound && reachable !== 'no',
  };
}

export const defaultPreflight = (env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): Promise<Preflight> =>
  runPreflight({ run: createCommandRunner({ env, platform }) });
