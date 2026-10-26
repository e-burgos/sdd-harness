import { execFile, spawn, type ChildProcess } from 'node:child_process';
import type { AuthAccount } from '@sdd-studio/protocol';

export const LOGIN_URL_WAIT_MS = 4000;
export const LOGIN_TIMEOUT_MS = 5 * 60_000;
const CLI_TIMEOUT_MS = 15_000;
const LOGIN_ARGS = ['auth', 'login', '--claudeai'];
const URL_PATTERN = /https:\/\/[^\s"'<>\u001b]+/;
const SECRET_PATTERN = /sk-ant-[A-Za-z0-9_-]+|Bearer\s+\S+/g;

export type CliResult = { code: number; stdout: string; stderr: string };
export type CliRunner = (file: string, args: string[], env: NodeJS.ProcessEnv) => Promise<CliResult>;
export type CliSpawner = (file: string, args: string[], env: NodeJS.ProcessEnv) => ChildProcess;

const runCli: CliRunner = (file, args, env) =>
  new Promise((resolve) => {
    execFile(file, args, { env, timeout: CLI_TIMEOUT_MS, maxBuffer: 1 << 20 }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : 127) : 0;
      resolve({ code, stdout: String(stdout), stderr: error && typeof error.code !== 'number' ? error.message : String(stderr) });
    });
  });

const spawnCli: CliSpawner = (file, args, env) => spawn(file, args, { env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });

const account = (patch: Partial<AuthAccount>): AuthAccount => ({
  state: 'disconnected',
  email: null,
  method: null,
  plan: null,
  loginUrl: null,
  error: null,
  ...patch,
});

const cleanText = (text: string): string => text.replace(/\u001b\[[0-9;]*m/g, '').replace(SECRET_PATTERN, '[redacted]').trim().slice(0, 300);
const str = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value.slice(0, 320) : null);

export function parseAuthStatus(stdout: string): AuthAccount | null {
  try {
    const raw = JSON.parse(stdout) as Record<string, unknown>;
    if (raw.loggedIn !== true) return account({ state: 'disconnected' });
    return account({ state: 'connected', email: str(raw.email), method: str(raw.authMethod), plan: str(raw.subscriptionType) });
  } catch {
    return null;
  }
}

export class ClaudeLogin {
  private child: ChildProcess | null = null;
  private loginUrl: string | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly env: () => NodeJS.ProcessEnv,
    private readonly io: { run: CliRunner; spawn: CliSpawner } = { run: runCli, spawn: spawnCli },
    private readonly bin = 'claude',
    private readonly urlWaitMs = LOGIN_URL_WAIT_MS,
    private readonly loginTimeoutMs = LOGIN_TIMEOUT_MS,
  ) {}

  async status(): Promise<AuthAccount> {
    if (this.child) return account({ state: 'pending', loginUrl: this.loginUrl });
    const result = await this.io.run(this.bin, ['auth', 'status', '--json'], this.env());
    const parsed = result.code === 0 ? parseAuthStatus(result.stdout) : null;
    if (!parsed) return account({ state: 'error', error: cleanText(result.stderr) || 'claude auth status failed' });
    if (parsed.state === 'connected') this.lastError = null;
    return parsed.state === 'disconnected' && this.lastError ? { ...parsed, error: this.lastError } : parsed;
  }

  async login(): Promise<AuthAccount> {
    if (this.child) return account({ state: 'pending', loginUrl: this.loginUrl });
    this.loginUrl = null;
    this.lastError = null;
    const child = this.io.spawn(this.bin, LOGIN_ARGS, this.env());
    this.child = child;
    let output = '';
    let finished = false;
    const timer = setTimeout(() => child.kill(), this.loginTimeoutMs);
    timer.unref?.();
    const finish = (code: number | null, spawnError?: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (this.child === child) this.child = null;
      if (spawnError) this.lastError = cleanText(spawnError);
      else if (code !== 0) this.lastError = cleanText(output) || 'claude auth login failed';
    };
    const onData = (chunk: Buffer | string) => {
      output = (output + String(chunk)).slice(-4000);
      if (!this.loginUrl) this.loginUrl = URL_PATTERN.exec(output)?.[0] ?? null;
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('error', (error) => finish(null, error.message));
    child.on('close', (code) => finish(code));
    const deadline = Date.now() + this.urlWaitMs;
    while (!this.loginUrl && !finished && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
    if (this.child === child) return account({ state: 'pending', loginUrl: this.loginUrl });
    return this.status();
  }

  async logout(): Promise<AuthAccount> {
    this.child?.kill();
    this.child = null;
    this.loginUrl = null;
    const result = await this.io.run(this.bin, ['auth', 'logout'], this.env());
    if (result.code !== 0) return account({ state: 'error', error: cleanText(result.stderr || result.stdout) || 'claude auth logout failed' });
    return this.status();
  }
}
