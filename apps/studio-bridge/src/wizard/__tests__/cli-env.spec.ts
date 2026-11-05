import { describe, expect, it } from 'vitest';
import { buildCliEnv } from '../cli-env';

describe('buildCliEnv', () => {
  const polluted = {
    PATH: '/usr/bin',
    HOME: '/home/dev',
    NODE_AUTH_TOKEN: 'registry-token',
    npm_config_registry: 'https://registry.example.test/',
    HTTPS_PROXY: 'http://proxy.test:3128',
    ANTHROPIC_API_KEY: 'sk-secret',
    ANTHROPIC_AUTH_TOKEN: 'token-secret',
    CI: 'true',
    NX_WORKSPACE_ROOT_PATH: '/other/repo',
    NX_DAEMON: 'true',
    npm_package_name: 'x',
    npm_lifecycle_event: 'start',
    npm_config_local_prefix: '/somewhere',
    INIT_CWD: '/somewhere',
    PNPM_SCRIPT_SRC_DIR: '/somewhere',
    npm_config_user_agent: 'pnpm/10 npm/? node/v20',
    npm_execpath: '/usr/lib/pnpm.cjs',
    npm_command: 'run-script',
  };

  it('drops credentials, CI, Nx and npx contamination', () => {
    const env = buildCliEnv(polluted);
    for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CI', 'NX_WORKSPACE_ROOT_PATH', 'npm_package_name', 'npm_lifecycle_event', 'npm_config_local_prefix', 'INIT_CWD', 'PNPM_SCRIPT_SRC_DIR', 'npm_config_user_agent', 'npm_execpath', 'npm_command']) {
      expect(env).not.toHaveProperty(key);
    }
  });

  it('pins color off and the Nx daemon off', () => {
    expect(buildCliEnv(polluted)).toMatchObject({ NO_COLOR: '1', FORCE_COLOR: '0', NX_DAEMON: 'false' });
  });

  it('keeps PATH, HOME, registry auth, registry and proxies', () => {
    expect(buildCliEnv(polluted)).toMatchObject({
      PATH: '/usr/bin',
      HOME: '/home/dev',
      NODE_AUTH_TOKEN: 'registry-token',
      npm_config_registry: 'https://registry.example.test/',
      HTTPS_PROXY: 'http://proxy.test:3128',
    });
  });

  it('matches names case-insensitively (win32 env)', () => {
    const env = buildCliEnv({ Anthropic_Api_Key: 'x', ci: '1', Nx_Foo: '1' });
    expect(Object.keys(env).sort()).toEqual(['FORCE_COLOR', 'NO_COLOR', 'NX_DAEMON']);
  });
});
