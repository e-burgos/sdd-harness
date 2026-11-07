import { execFile } from 'node:child_process';

export interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  missing: boolean;
}

export interface ExecOptions {
  cwd?: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
}

export type Exec = (file: string, args: string[], options: ExecOptions) => Promise<ExecResult>;

const MAX_BUFFER = 4 * 1024 * 1024;

export const defaultExec: Exec = (file, args, options) =>
  new Promise((resolve) => {
    execFile(
      file,
      args,
      { cwd: options.cwd, timeout: options.timeoutMs, env: options.env, maxBuffer: MAX_BUFFER, shell: false, windowsHide: true },
      (error, stdout, stderr) => {
        const failure = error as (NodeJS.ErrnoException & { killed?: boolean; code?: number | string }) | null;
        resolve({
          code: failure === null ? 0 : typeof failure.code === 'number' ? failure.code : null,
          stdout: String(stdout),
          stderr: String(stderr),
          timedOut: failure?.killed === true,
          missing: failure?.code === 'ENOENT',
        });
      },
    );
  });
