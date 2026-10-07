import type { AuthMode } from '@sdd-studio/protocol';

/** Con ANTHROPIC_API_KEY el SDK usa la key; sin ella, el login local de Claude Code. */
export const detectAuthMode = (env: NodeJS.ProcessEnv = process.env): AuthMode =>
  env.ANTHROPIC_API_KEY ? 'api-key' : 'local-claude-login';
