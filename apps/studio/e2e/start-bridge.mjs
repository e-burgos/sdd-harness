// Copia el workspace de prueba del puente y arranca sdd-studio con el motor fake y la web local.
import { execFileSync, spawn } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const WORKSPACE = path.resolve(here, '../.e2e-workspace');
const fixture = path.resolve(here, '../../studio-bridge/test/fixtures/workspace');
const bin = path.resolve(here, '../../studio-bridge/bin/sdd-studio.mjs');

await rm(WORKSPACE, { recursive: true, force: true });
await cp(fixture, WORKSPACE, { recursive: true });
await mkdir(path.join(WORKSPACE, '.claude/skills'), { recursive: true });
execFileSync('git', ['init', '-q'], { cwd: WORKSPACE });
const child = spawn(
  process.execPath,
  [bin, '--engine', 'fake', '--no-open', '--port', process.env.E2E_PORT ?? '4399', '--token', 'e2e-token-0123456789abcdef', '--local-ui', '--root', WORKSPACE],
  { stdio: 'inherit' },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));
