import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const studio = path.resolve(here, '..');
const bridge = path.resolve(studio, '../studio-bridge');
const stateDir = path.join(studio, '.e2e-launcher');
const port = Number(process.env.E2E_LAUNCHER_PORT ?? '4417');
const token = 'e2e-launcher-token-0123456789';

const { build } = createRequire(path.join(bridge, 'package.json'))('esbuild');
const bundleDir = path.join(bridge, 'node_modules/.cache/e2e-launcher');
const bundle = path.join(bundleDir, 'bridge.mjs');
await rm(bundleDir, { recursive: true, force: true });
await build({
  stdin: {
    contents: `export { startBridge, DEFAULT_ORIGINS } from './src/main.ts'; export { createWizardCommands } from './src/wizard/service.ts';`,
    resolveDir: bridge,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: bundle,
  external: ['@anthropic-ai/claude-agent-sdk', 'ajv', 'chokidar', 'citty', 'picocolors', 'ws', 'zod'],
  logLevel: 'error',
});
const { startBridge, DEFAULT_ORIGINS, createWizardCommands } = await import(pathToFileURL(bundle).href);

await rm(stateDir, { recursive: true, force: true });
await mkdir(stateDir, { recursive: true });
const sandbox = await realpath(await mkdtemp(path.join(tmpdir(), 'sdd-wizard-e2e-')));
const launcherRoot = path.join(sandbox, 'launcher');
const targets = path.join(sandbox, 'targets');
await mkdir(launcherRoot);
await mkdir(targets);
await writeFile(path.join(stateDir, 'state.json'), JSON.stringify({ targets, token }));

const cliPackage = JSON.parse(await readFile(path.resolve(studio, '../cli/package.json'), 'utf8'));
const harnessCli = { bin: path.join(here, 'fake-harness-cli.mjs'), version: cliPackage.version };
const preflight = async () => ({
  node: { version: process.versions.node },
  pnpm: { found: true, version: '9.0.0' },
  git: { found: true, identity: true },
  registry: { url: 'https://registry.e2e.invalid/', reachable: 'yes' },
  ready: true,
});

const running = await startBridge({
  root: launcherRoot,
  port,
  strictPort: true,
  engine: 'fake',
  allowedOrigins: DEFAULT_ORIGINS,
  webUrl: `http://127.0.0.1:${port}`,
  token,
  localUiDir: path.join(studio, 'out'),
  allowTargets: [targets],
  harnessCli,
  hostCommands: (host) => createWizardCommands(host, { cli: harnessCli, preflight }),
});
console.log(`launcher bridge ready on ${running.url}`);

const shutdown = async () => {
  await running.close().catch(() => undefined);
  await rm(sandbox, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  process.exit(0);
};
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, shutdown);
