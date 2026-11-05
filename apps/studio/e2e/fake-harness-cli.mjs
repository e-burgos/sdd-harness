import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bridge = path.resolve(here, '../../studio-bridge');
const realCli = path.resolve(here, '../../cli/bin/harness.mjs');
const argv = process.argv.slice(2);

if (argv[0] !== 'init') {
  const child = spawn(process.execPath, [realCli, ...argv], { stdio: 'inherit' });
  child.on('exit', (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 1)));
} else {
  const config = JSON.parse(readFileSync('harness.config.json', 'utf8'));
  const gateRed = String(config.project?.name ?? '').includes('red');
  process.env.FAKE_HARNESS_REPLAY = path.join(bridge, 'src/wizard/__fixtures__/init-output', gateRed ? 'nx-gate-red.txt' : 'nx-success.txt');
  process.env.FAKE_HARNESS_EXIT_CODE = gateRed ? '1' : '0';
  process.env.FAKE_HARNESS_COPY_FROM = path.join(bridge, 'test/fixtures/workspace');
  await import(path.join(bridge, 'src/test-utils/fake-harness.mjs'));
}
