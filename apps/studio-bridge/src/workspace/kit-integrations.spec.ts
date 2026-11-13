import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Exec, ExecResult } from '../github/exec';
import { createKitIntegrations, INTEGRATION_SET_TIMEOUT_MS, INTEGRATION_STATUS_TIMEOUT_MS, normalizeIntegrationStatus } from './kit-integrations';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'kit-integrations-'));
  await mkdir(path.join(root, 'sdd/scripts'), { recursive: true });
  for (const name of ['sdd-tucu.mjs', 'sdd-video.mjs']) await writeFile(path.join(root, 'sdd/scripts', name), '');
});
afterEach(() => rm(root, { recursive: true, force: true }));

const ok = (stdout: string): ExecResult => ({ code: 0, stdout, stderr: '', timedOut: false, missing: false });

const tucuRaw = {
  enabled: true, state: 'complete', parts: { skill: true, mcp: true }, version: '0.16.0', kit_version: '0.16.0',
  update_available: false, node_ok: true, skill: { installed: true },
  harnesses: { claude: 'complete', copilot: 'complete', gemini: 'incomplete', antigravity: 'complete' },
};
const videoRaw = {
  enabled: true, state: 'incomplete', parts: { plugin: true, mcp: false }, version: '0.1.0', kit_version: '0.2.0',
  update_available: true, node_ok: false, plugin: { state: 'missing' },
  harnesses: { claude: 'incomplete', copilot: 'complete', gemini: 'complete', antigravity: 'incomplete' }, repair: 'pnpm sdd:video -- --enable',
};

function recorder(handler: (args: string[]) => ExecResult) {
  const calls: { file: string; args: string[]; cwd?: string; timeoutMs: number }[] = [];
  const exec: Exec = async (file, args, options) => {
    calls.push({ file, args, cwd: options.cwd, timeoutMs: options.timeoutMs });
    return handler(args);
  };
  return { exec, calls };
}

describe('normalizeIntegrationStatus', () => {
  it('maps the tucu-ui script shape', () => {
    expect(normalizeIntegrationStatus('tucu-ui', tucuRaw)).toEqual({
      integration: 'tucu-ui', available: true, enabled: true, state: 'complete', parts: { skill: true, mcp: true },
      version: '0.16.0', kitVersion: '0.16.0', updateAvailable: false, nodeOk: true,
      harnesses: { claude: 'complete', copilot: 'complete', gemini: 'incomplete', antigravity: 'complete' }, repair: null,
    });
  });
  it('maps the video-maker script shape including repair and update', () => {
    expect(normalizeIntegrationStatus('video-maker', videoRaw)).toMatchObject({
      state: 'incomplete', parts: { plugin: true, mcp: false }, kitVersion: '0.2.0', updateAvailable: true, nodeOk: false,
      repair: 'pnpm sdd:video -- --enable',
    });
  });
  it('falls back to unavailable on an unknown state and tolerates junk', () => {
    expect(normalizeIntegrationStatus('tucu-ui', { ...tucuRaw, state: 'weird' }).state).toBe('unavailable');
    expect(normalizeIntegrationStatus('tucu-ui', 'junk')).toMatchObject({ enabled: false, harnesses: { claude: 'incomplete' } });
  });
});

describe('createKitIntegrations.status', () => {
  it('runs the script with the current node, cwd at the root and the status timeout', async () => {
    const { exec, calls } = recorder(() => ok(JSON.stringify(tucuRaw)));
    const status = await createKitIntegrations(exec).status(root, 'tucu-ui');
    expect(status.state).toBe('complete');
    expect(calls).toEqual([{ file: process.execPath, args: [path.join(root, 'sdd/scripts/sdd-tucu.mjs'), '--status'], cwd: root, timeoutMs: INTEGRATION_STATUS_TIMEOUT_MS }]);
  });
  it('a missing script is unavailable without spawning anything', async () => {
    await rm(path.join(root, 'sdd/scripts/sdd-video.mjs'));
    const { exec, calls } = recorder(() => ok('{}'));
    expect(await createKitIntegrations(exec).status(root, 'video-maker')).toMatchObject({ available: false, enabled: false, state: 'unavailable' });
    expect(calls).toEqual([]);
  });
  it('a failing, timed out or non-JSON status is unavailable', async () => {
    for (const result of [{ ...ok(''), code: 1 }, { ...ok('{}'), timedOut: true }, ok('not json')]) {
      expect((await createKitIntegrations(recorder(() => result).exec).status(root, 'tucu-ui')).state).toBe('unavailable');
    }
  });
});

describe('createKitIntegrations.set', () => {
  it('enable runs --enable with the long timeout and returns the status read afterwards', async () => {
    const { exec, calls } = recorder((args) => (args[1] === '--status' ? ok(JSON.stringify(tucuRaw)) : ok('tucu_ui: on\n')));
    const result = await createKitIntegrations(exec).set(root, 'tucu-ui', true);
    expect(result).toMatchObject({ ok: true, exitCode: 0, output: 'tucu_ui: on', status: { state: 'complete' } });
    expect(calls.map((c) => [c.args[1], c.timeoutMs])).toEqual([['--enable', INTEGRATION_SET_TIMEOUT_MS], ['--status', INTEGRATION_STATUS_TIMEOUT_MS]]);
  });
  it('disable runs --disable', async () => {
    const { exec, calls } = recorder((args) => (args[1] === '--status' ? ok(JSON.stringify({ ...tucuRaw, enabled: false, state: 'off' })) : ok('off')));
    const result = await createKitIntegrations(exec).set(root, 'tucu-ui', false);
    expect(result.status).toMatchObject({ enabled: false, state: 'off' });
    expect(calls[0]?.args[1]).toBe('--disable');
  });
  it('a failing script is ok false with its output', async () => {
    const { exec } = recorder((args) => (args[1] === '--status' ? ok(JSON.stringify(videoRaw)) : { code: 1, stdout: '', stderr: 'network down\n', timedOut: false, missing: false }));
    expect(await createKitIntegrations(exec).set(root, 'video-maker', true)).toMatchObject({ ok: false, exitCode: 1, output: 'network down' });
  });
  it('a timeout is ok false and says so', async () => {
    const { exec } = recorder((args) => (args[1] === '--status' ? ok(JSON.stringify(tucuRaw)) : { code: null, stdout: 'partial', stderr: '', timedOut: true, missing: false }));
    const result = await createKitIntegrations(exec).set(root, 'tucu-ui', true);
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBeNull();
    expect(result.output).toContain('timeout');
  });
  it('trims the output to 8 KiB keeping the tail', async () => {
    const { exec } = recorder((args) => (args[1] === '--status' ? ok(JSON.stringify(tucuRaw)) : { code: 1, stdout: `${'a'.repeat(20_000)}END`, stderr: '', timedOut: false, missing: false }));
    const result = await createKitIntegrations(exec).set(root, 'tucu-ui', true);
    expect(result.output).toHaveLength(8192);
    expect(result.output.endsWith('END')).toBe(true);
  });
  it('a missing script is ok false, unavailable and never spawns', async () => {
    await rm(path.join(root, 'sdd/scripts/sdd-tucu.mjs'));
    const { exec, calls } = recorder(() => ok(''));
    expect(await createKitIntegrations(exec).set(root, 'tucu-ui', true)).toMatchObject({ ok: false, exitCode: null, status: { available: false } });
    expect(calls).toEqual([]);
  });
});
