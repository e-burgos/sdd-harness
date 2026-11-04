import { appendFileSync, existsSync } from 'node:fs';

const FAKE_VERSION = '0.0.0-fake';
const argv = process.argv.slice(2);
const mode = process.env.FAKE_HARNESS_MODE ?? 'ok';

const log = (entry) => {
  if (process.env.FAKE_HARNESS_LOG) appendFileSync(process.env.FAKE_HARNESS_LOG, `${JSON.stringify(entry)}\n`);
};

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

const waitForFile = async (file) => {
  while (!existsSync(file)) await new Promise((resolve) => setTimeout(resolve, 10));
};

const catalog = {
  format: 1,
  cliVersion: FAKE_VERSION,
  modes: [
    { mode: 'nx', maxApps: null, libs: true },
    { mode: 'standalone', maxApps: 1, libs: false },
  ],
  appTypes: [
    {
      type: 'nestjs',
      label: 'NestJS API',
      hint: 'REST API',
      role: 'backend',
      defaultName: 'api',
      defaultPort: 3000,
      stack: 'NestJS',
      stackPlain: null,
      workspaceOnly: false,
      tucuUi: false,
      ml: false,
      shell: false,
    },
  ],
  libTypes: [{ type: 'shared', label: 'Shared' }],
  serviceTypes: [{ type: 'postgres', label: 'PostgreSQL', hint: 'database', defaultPort: 5432, version: '16' }],
  profiles: ['team', 'solo'],
  patterns: { name: '^[a-z][a-z0-9-]*$', packageScope: '^@[a-z][a-z0-9-]*$', author: '^[a-z][a-z0-9-]*$' },
  portRange: { min: 1024, max: 65535 },
  targetDir: { tolerated: ['.git', 'README.md'] },
  jsonSchema: {},
};

const validation = (config) => {
  const invalid = config && config.__invalid === true;
  return {
    format: 1,
    cliVersion: FAKE_VERSION,
    ok: !invalid,
    issues: invalid
      ? [{ severity: 'error', code: 'fake-invalid', path: [], message: 'invalid by request' }]
      : [{ severity: 'warning', code: 'echo', path: [], message: String(config?.tag ?? '') }],
    resolved: null,
  };
};

const main = async () => {
  log({ argv, env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? null, CI: process.env.CI ?? null, NX_DAEMON: process.env.NX_DAEMON ?? null } });
  if (mode === 'env-check') {
    const leaked = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CI', 'NX_WORKSPACE_ROOT_PATH'].filter((key) => process.env[key] !== undefined);
    if (leaked.length > 0 || process.env.NX_DAEMON !== 'false') process.exit(3);
  }
  if (mode === 'hang') return setInterval(() => undefined, 1000);
  if (mode === 'garbage') return process.stdout.write('not json');
  if (mode === 'flood') return process.stdout.write('x'.repeat(4 * 1024 * 1024));
  if (mode === 'exit-2') process.exit(2);

  const [group, action] = argv;
  if (group === 'config' && action === 'catalog') return process.stdout.write(`${JSON.stringify(catalog)}\n`);
  if (group === 'config' && action === 'validate') {
    const config = JSON.parse((await readStdin()) || '{}');
    if (process.env.FAKE_HARNESS_GATE) {
      if (process.env.FAKE_HARNESS_STARTED) appendFileSync(process.env.FAKE_HARNESS_STARTED, 'started\n');
      await waitForFile(process.env.FAKE_HARNESS_GATE);
    }
    const result = validation(config);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exit(result.ok ? 0 : 1);
  }
  process.exit(2);
};

await main();
