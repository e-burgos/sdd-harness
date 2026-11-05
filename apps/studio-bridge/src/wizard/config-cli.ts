import { spawn } from 'node:child_process';
import { ConfigCatalog, ConfigCliFailure, ConfigValidation } from '@sdd-studio/protocol';
import { buildCliEnv } from './cli-env';
import type { HarnessCli } from './cli-locator';

export const CONFIG_CLI_TIMEOUT_MS = 10_000;
export const CONFIG_CLI_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

export class ConfigCliError extends Error {}

export interface ConfigCli {
  catalog(): Promise<ConfigCatalog>;
  validate(config: Record<string, unknown>): Promise<ConfigValidation>;
  validateExact(config: Record<string, unknown>): Promise<ConfigValidation>;
}

interface CliRun {
  code: number | null;
  stdout: string;
}

function runCli(o: { cli: HarnessCli; args: string[]; stdin?: string; env: NodeJS.ProcessEnv; timeoutMs: number; maxOutputBytes: number }): Promise<CliRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [o.cli.bin, ...o.args], {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: buildCliEnv(o.env),
      windowsHide: true,
    });
    const chunks: Buffer[] = [];
    let received = 0;
    let failure: ConfigCliError | null = null;
    const fail = (error: ConfigCliError) => {
      failure ??= error;
      child.kill('SIGKILL');
    };
    const timer = setTimeout(() => fail(new ConfigCliError(`harness ${o.args[0]} timed out after ${o.timeoutMs} ms`)), o.timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > o.maxOutputBytes) return fail(new ConfigCliError(`harness ${o.args[0]} output exceeds ${o.maxOutputBytes} bytes`));
      chunks.push(chunk);
      return undefined;
    });
    child.stderr.resume();
    child.stdin.on('error', () => undefined);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(new ConfigCliError(`cannot run harness: ${error.message}`));
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (failure) return reject(failure);
      return resolve({ code, stdout: Buffer.concat(chunks).toString('utf8') });
    });
    child.stdin.end(o.stdin ?? '');
  });
}

function failureFrom(stdout: string): ConfigCliFailure | null {
  try {
    const parsed = ConfigCliFailure.safeParse(JSON.parse(stdout));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function parseOutput<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, run: CliRun, cli: HarnessCli, acceptedCodes: number[]): T {
  const mismatch = () => new ConfigCliError(`CLI ${cli.version} output does not match the protocol`);
  if (run.code === 2) {
    const failure = failureFrom(run.stdout);
    if (failure) throw new ConfigCliError(`CLI ${cli.version} rejected the request: ${failure.error.message}`);
  }
  if (run.code === null || !acceptedCodes.includes(run.code)) throw new ConfigCliError(`CLI ${cli.version} failed with exit code ${run.code}`);
  let json: unknown;
  try {
    json = JSON.parse(run.stdout);
  } catch {
    throw mismatch();
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw mismatch();
  return parsed.data;
}

export function createConfigCli(o: {
  cli: HarnessCli;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxOutputBytes?: number;
}): ConfigCli {
  const env = o.env ?? process.env;
  const timeoutMs = o.timeoutMs ?? CONFIG_CLI_TIMEOUT_MS;
  const maxOutputBytes = o.maxOutputBytes ?? CONFIG_CLI_MAX_OUTPUT_BYTES;
  const run = (args: string[], stdin?: string) => runCli({ cli: o.cli, args, stdin, env, timeoutMs, maxOutputBytes });

  let catalogPromise: Promise<ConfigCatalog> | null = null;
  let running = false;
  let queued: { config: Record<string, unknown>; waiters: { resolve(v: ConfigValidation): void; reject(e: unknown): void }[] } | null = null;

  const validateOnce = async (config: Record<string, unknown>) =>
    parseOutput(ConfigValidation, await run(['config', 'validate', '-', '--json'], JSON.stringify(config)), o.cli, [0, 1]);

  const drain = async (): Promise<void> => {
    running = true;
    while (queued) {
      const job = queued;
      queued = null;
      try {
        const result = await validateOnce(job.config);
        for (const waiter of job.waiters) waiter.resolve(result);
      } catch (error) {
        for (const waiter of job.waiters) waiter.reject(error);
      }
    }
    running = false;
  };

  return {
    catalog: () => {
      catalogPromise ??= run(['config', 'catalog', '--json']).then((result) => parseOutput(ConfigCatalog, result, o.cli, [0]));
      catalogPromise.catch(() => {
        catalogPromise = null;
      });
      return catalogPromise;
    },
    validateExact: (config) => validateOnce(config),
    validate: (config) =>
      new Promise<ConfigValidation>((resolve, reject) => {
        const waiters = [...(queued?.waiters ?? []), { resolve, reject }];
        queued = { config, waiters };
        if (!running) void drain();
      }),
  };
}
