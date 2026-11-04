import { withoutCredentialEnv } from '../auth-mode';

const DROPPED_EXACT = new Set(['anthropic_api_key', 'anthropic_auth_token', 'ci', 'init_cwd', 'pnpm_script_src_dir', 'npm_config_local_prefix']);
const DROPPED_PREFIXES = ['nx_', 'npm_package_', 'npm_lifecycle_'];

export function buildCliEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(withoutCredentialEnv(env))) {
    const lower = key.toLowerCase();
    if (DROPPED_EXACT.has(lower) || DROPPED_PREFIXES.some((prefix) => lower.startsWith(prefix))) continue;
    clean[key] = value;
  }
  Object.assign(clean, { NO_COLOR: '1', FORCE_COLOR: '0', NX_DAEMON: 'false' });
  return clean as NodeJS.ProcessEnv;
}
