import type { AuthMode } from '@sdd-studio/protocol';

/** With ANTHROPIC_API_KEY the SDK uses the key; without it, the local Claude Code login. */
export const detectAuthMode = (env: NodeJS.ProcessEnv = process.env): AuthMode =>
  env.ANTHROPIC_API_KEY ? 'api-key' : 'local-claude-login';

/**
 * Sent by the SDK in the User-Agent so the API sees calls as coming from Studio, not from the Claude Code CLI.
 * Honest label only: it does not (and must not) change which credit or plan the key is billed to.
 */
export const CLIENT_APP = (version: string): string => `sdd-studio/${version}`;

/**
 * In-memory API key supplied by the browser (it keeps it in its own storage and re-sends it on every
 * connection). Never written to disk, never logged, never echoed back.
 */
export class AuthState {
  private apiKey: string | null = null;

  constructor(
    private readonly baseEnv: NodeJS.ProcessEnv = process.env,
    private readonly clientApp: string = CLIENT_APP('0.0.0'),
  ) {}

  set(apiKey: string | null): AuthMode {
    this.apiKey = apiKey;
    return this.mode();
  }

  mode(): AuthMode {
    return this.apiKey ? 'api-key' : detectAuthMode(this.baseEnv);
  }

  /** Full env for the SDK subprocess (`options.env` replaces the environment, it is not merged). */
  env(): Record<string, string | undefined> {
    const env: Record<string, string | undefined> = { ...this.baseEnv, CLAUDE_AGENT_SDK_CLIENT_APP: this.clientApp };
    if (this.apiKey) env.ANTHROPIC_API_KEY = this.apiKey;
    return env;
  }
}
