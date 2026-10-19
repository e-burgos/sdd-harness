import type { AuthMode } from '@sdd-studio/protocol';

/** With ANTHROPIC_API_KEY the SDK uses the key; without it, the local Claude Code login. */
export const detectAuthMode = (env: NodeJS.ProcessEnv = process.env): AuthMode =>
  env.ANTHROPIC_API_KEY ? 'api-key' : 'local-claude-login';
