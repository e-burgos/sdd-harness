import { appendFileSync, readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { waitFor } from '../../test-utils/fixture';
import { ConfigCliError, createConfigCli } from '../config-cli';

const FAKE_BIN = fileURLToPath(new URL('../../test-utils/fake-harness.mjs', import.meta.url));
const cli = { bin: FAKE_BIN, version: '0.0.0-fake' };

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'config-cli-'));
  await writeFile(path.join(dir, 'log'), '');
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const fakeEnv = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({ ...process.env, FAKE_HARNESS_LOG: path.join(dir, 'log'), ...extra });
const logged = () =>
  readFileSync(path.join(dir, 'log'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { argv: string[]; env: Record<string, string | null> });

describe('createConfigCli', () => {
  it('parses the catalog and runs the CLI only once', async () => {
    const configCli = createConfigCli({ cli, env: fakeEnv() });
    const [first, second] = await Promise.all([configCli.catalog(), configCli.catalog()]);
    expect(first.cliVersion).toBe('0.0.0-fake');
    expect(second).toBe(first);
    expect((await configCli.catalog()).appTypes).toHaveLength(1);
    expect(logged()).toHaveLength(1);
    expect(logged()[0]!.argv).toEqual(['config', 'catalog', '--json']);
  });

  it('validates through stdin and accepts exit code 1 with errors', async () => {
    const configCli = createConfigCli({ cli, env: fakeEnv() });
    const ok = await configCli.validate({ tag: 'a' });
    expect(ok).toMatchObject({ ok: true, issues: [{ code: 'echo', message: 'a' }] });
    const invalid = await configCli.validate({ __invalid: true });
    expect(invalid).toMatchObject({ ok: false, issues: [{ severity: 'error', code: 'fake-invalid' }] });
    expect(logged().map((entry) => entry.argv)).toEqual([
      ['config', 'validate', '-', '--json'],
      ['config', 'validate', '-', '--json'],
    ]);
  });

  it('passes a sanitized environment to the child (no credentials, no CI, Nx daemon off)', async () => {
    const configCli = createConfigCli({
      cli,
      env: fakeEnv({ FAKE_HARNESS_MODE: 'env-check', ANTHROPIC_API_KEY: 'sk-secret', CI: 'true', NX_WORKSPACE_ROOT_PATH: '/other' }),
    });
    await expect(configCli.catalog()).resolves.toBeDefined();
    expect(logged()[0]!.env).toEqual({ ANTHROPIC_API_KEY: null, CI: null, NX_DAEMON: 'false' });
  });

  it('maps unparseable and mismatching output to internal', async () => {
    const garbage = createConfigCli({ cli, env: fakeEnv({ FAKE_HARNESS_MODE: 'garbage' }) });
    await expect(garbage.catalog()).rejects.toMatchObject({ message: 'CLI 0.0.0-fake output does not match the protocol' });
    await expect(garbage.validate({})).rejects.toBeInstanceOf(ConfigCliError);
  });

  it('fails on a usage exit code', async () => {
    const configCli = createConfigCli({ cli, env: fakeEnv({ FAKE_HARNESS_MODE: 'exit-2' }) });
    await expect(configCli.validate({})).rejects.toBeInstanceOf(ConfigCliError);
  });

  it('retries the catalog after a failure', async () => {
    const env = fakeEnv({ FAKE_HARNESS_MODE: 'garbage' });
    const configCli = createConfigCli({ cli, env });
    await expect(configCli.catalog()).rejects.toBeDefined();
    env.FAKE_HARNESS_MODE = 'ok';
    await expect(configCli.catalog()).resolves.toMatchObject({ format: 1 });
  });

  it('kills a hung child at the timeout', async () => {
    const configCli = createConfigCli({ cli, env: fakeEnv({ FAKE_HARNESS_MODE: 'hang' }), timeoutMs: 300 });
    await expect(configCli.catalog()).rejects.toMatchObject({ message: expect.stringContaining('timed out') });
  });

  it('caps the output size', async () => {
    const configCli = createConfigCli({ cli, env: fakeEnv({ FAKE_HARNESS_MODE: 'flood' }), maxOutputBytes: 1024 });
    await expect(configCli.catalog()).rejects.toMatchObject({ message: expect.stringContaining('exceeds') });
  });

  it('runs one validation at a time and the last queued request wins', async () => {
    const gate = path.join(dir, 'gate');
    const started = path.join(dir, 'started');
    await writeFile(started, '');
    const configCli = createConfigCli({ cli, env: fakeEnv({ FAKE_HARNESS_GATE: gate, FAKE_HARNESS_STARTED: started }) });
    const first = configCli.validate({ tag: 'first' });
    await waitFor(() => readFileSync(started, 'utf8').includes('started'));
    const second = configCli.validate({ tag: 'second' });
    const third = configCli.validate({ tag: 'third' });
    appendFileSync(gate, '');
    const results = await Promise.all([first, second, third]);
    expect(results.map((r) => r.issues[0]!.message)).toEqual(['first', 'third', 'third']);
    expect(logged()).toHaveLength(2);
  });
});
