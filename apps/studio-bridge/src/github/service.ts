import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  GithubConnectResult,
  GithubRemote,
  GithubStatus,
  type ClientCommand,
  type GithubConnectRequest,
} from '@sdd-studio/protocol';
import type { ProjectRuntime } from '../project/runtime';
import { SessionError } from '../sessions/session-manager';
import { buildCliEnv } from '../wizard/cli-env';
import { locateHarnessCli, type HarnessCli } from '../wizard/cli-locator';
import type { GenerationRegistry } from '../wizard/generation';
import { defaultExec, type Exec } from './exec';

export const STATUS_TIMEOUT_MS = 20_000;
export const CONNECT_TIMEOUT_MS = 180_000;
const ERROR_LIMIT = 2000;

export type GithubCommand = Extract<ClientCommand, { cmd: 'github.status' | 'github.connect' }>;

export const isGithubCommand = (command: ClientCommand): command is GithubCommand =>
  command.cmd === 'github.status' || command.cmd === 'github.connect';

export interface GithubHost {
  readonly generations: Pick<GenerationRegistry, 'find'>;
  readonly runtime: Pick<ProjectRuntime, 'root' | 'refreshGithub'> | null;
}

export interface GithubServiceOptions {
  cli?: HarnessCli;
  exec?: Exec;
  env?: () => NodeJS.ProcessEnv;
}

const clip = (text: string): string => text.trim().slice(0, ERROR_LIMIT);

function errorMessageOf(error: unknown): string | null {
  if (typeof error === 'string') return error;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function connectArgs(target: string, request: GithubConnectRequest): string[] {
  return [
    'github',
    'connect',
    '--dir',
    target,
    ...(request.name ? ['--name', request.name] : []),
    ...(request.owner ? ['--owner', request.owner] : []),
    ...(request.visibility === 'public' ? ['--public'] : []),
    ...(request.protect ? ['--protect'] : []),
    '--yes',
    '--json',
  ];
}

export class GithubService {
  private cliCache: HarnessCli | null = null;

  constructor(
    private readonly host: GithubHost,
    private readonly o: GithubServiceOptions = {},
  ) {}

  private cli(): HarnessCli {
    this.cliCache ??= this.o.cli ?? locateHarnessCli();
    return this.cliCache;
  }

  private target(generationId: string | undefined): string {
    if (generationId === undefined) {
      const runtime = this.host.runtime;
      if (!runtime) throw new SessionError('not-found', 'no project open');
      return runtime.root;
    }
    const state = this.host.generations.find(generationId);
    if (!state) throw new SessionError('not-found', 'unknown generation');
    if (state.status !== 'succeeded' || !existsSync(path.join(state.target, 'sdd'))) {
      throw new SessionError('conflict', 'the generation did not finish successfully');
    }
    return state.target;
  }

  private run(args: string[], timeoutMs: number) {
    const cli = this.cli();
    return (this.o.exec ?? defaultExec)(process.execPath, [cli.bin, ...args], {
      timeoutMs,
      env: buildCliEnv(this.o.env?.() ?? process.env),
    });
  }

  private async status(generationId: string | undefined): Promise<GithubStatus> {
    const target = this.target(generationId);
    const result = await this.run(['github', 'status', '--dir', target, '--json'], STATUS_TIMEOUT_MS);
    if (result.timedOut) throw new Error('github status timed out');
    const parsed = GithubStatus.safeParse(parseJson(result.stdout));
    if (!parsed.success) throw new Error(clip(result.stderr) || 'github status returned no usable output');
    return parsed.data;
  }

  private async connect(request: GithubConnectRequest): Promise<GithubConnectResult> {
    const target = this.target(request.generationId);
    const failure = (error: string): GithubConnectResult => ({ ok: false, remote: null, protected: false, error: clip(error) });
    const result = await this.run(connectArgs(target, request), CONNECT_TIMEOUT_MS);
    if (result.timedOut) return failure('connecting to GitHub timed out');
    const body = parseJson(result.stdout);
    if (body === undefined || body === null || typeof body !== 'object') {
      return failure(result.stderr || 'the harness CLI returned no usable output');
    }
    const record = body as { ok?: unknown; remote?: unknown; protected?: unknown; error?: unknown };
    if (record.ok !== true) return failure(errorMessageOf(record.error) ?? (result.stderr || 'connecting to GitHub failed'));
    const remote = GithubRemote.safeParse(record.remote);
    const parsed = GithubConnectResult.safeParse({ ok: true, remote: remote.success ? remote.data : null, protected: record.protected === true, error: null });
    if (!parsed.success) return failure('the harness CLI returned an unexpected result');
    if (request.generationId === undefined) await this.host.runtime?.refreshGithub().catch(() => undefined);
    return parsed.data;
  }

  readonly handle = async (command: GithubCommand): Promise<GithubStatus | GithubConnectResult> => {
    if (command.cmd === 'github.status') return this.status(command.generationId);
    return this.connect(command);
  };
}
