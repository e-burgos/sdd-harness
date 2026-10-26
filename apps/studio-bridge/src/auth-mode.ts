import type { AuthMode, AuthPreference } from '@sdd-studio/protocol';

const CREDENTIAL_ENV_KEYS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'] as const;

export const withoutCredentialEnv = <T extends Record<string, string | undefined>>(env: T): T => {
  const clean = { ...env };
  for (const key of CREDENTIAL_ENV_KEYS) delete clean[key];
  return clean;
};

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
  private preference: AuthPreference | null = null;

  constructor(
    private readonly baseEnv: NodeJS.ProcessEnv = process.env,
    private readonly clientApp: string = CLIENT_APP('0.0.0'),
  ) {}

  set(apiKey: string | null, preference?: AuthPreference): AuthMode {
    this.preference = preference ?? (apiKey ? 'api-key' : null);
    this.apiKey = this.preference === 'subscription' ? null : apiKey;
    return this.mode();
  }

  mode(): AuthMode {
    if (this.preference === 'subscription') return 'local-claude-login';
    return this.apiKey ? 'api-key' : detectAuthMode(this.baseEnv);
  }

  /** Env for the `claude auth …` CLI: never inherits credentials, so it reports and edits the account login. */
  cliEnv(): NodeJS.ProcessEnv {
    return withoutCredentialEnv(this.baseEnv);
  }

  /** Full env for the SDK subprocess (`options.env` replaces the environment, it is not merged). */
  env(): Record<string, string | undefined> {
    const env: Record<string, string | undefined> = { ...this.baseEnv, CLAUDE_AGENT_SDK_CLIENT_APP: this.clientApp };
    if (this.preference === 'subscription') return { ...withoutCredentialEnv(env), CLAUDE_AGENT_SDK_CLIENT_APP: this.clientApp };
    if (this.apiKey) {
      env.ANTHROPIC_API_KEY = this.apiKey;
      delete env.ANTHROPIC_AUTH_TOKEN;
    }
    return env;
  }
}
