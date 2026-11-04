import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCommandRunner, runPreflight, type CommandResult, type PreflightCommand, type RunPreflightCommand } from '../preflight';

const ok = (stdout: string): CommandResult => ({ code: 0, stdout: `${stdout}\n` });
const missing: CommandResult = { code: null, stdout: '' };

const scripted =
  (answers: Partial<Record<PreflightCommand, CommandResult>>): RunPreflightCommand =>
  async (command) =>
    answers[command] ?? missing;

const healthy = {
  pnpmVersion: ok('9.15.0'),
  pnpmRegistry: ok('https://registry.npmjs.org/'),
  gitVersion: ok('git version 2.45.0'),
  gitUserName: ok('Dev'),
  gitUserEmail: ok('dev@example.test'),
};

describe('runPreflight', () => {
  it('is ready when pnpm exists and the registry answers', async () => {
    const probed: string[] = [];
    const result = await runPreflight({ run: scripted(healthy), probe: async (url) => (probed.push(url), true), nodeVersion: '22.1.0' });
    expect(result).toEqual({
      node: { version: '22.1.0' },
      pnpm: { found: true, version: '9.15.0' },
      git: { found: true, identity: true },
      registry: { url: 'https://registry.npmjs.org/', reachable: 'yes' },
      ready: true,
    });
    expect(probed).toEqual(['https://registry.npmjs.org/']);
  });

  it('blocks when pnpm is missing and does not probe the registry', async () => {
    let probes = 0;
    const result = await runPreflight({ run: scripted({ ...healthy, pnpmVersion: missing, pnpmRegistry: missing }), probe: async () => (probes++, true) });
    expect(result).toMatchObject({ pnpm: { found: false, version: null }, registry: { url: null, reachable: 'unknown' }, ready: false });
    expect(probes).toBe(0);
  });

  it('reports an unreachable registry as a blocking notice without throwing', async () => {
    const result = await runPreflight({ run: scripted(healthy), probe: async () => false });
    expect(result).toMatchObject({ registry: { url: 'https://registry.npmjs.org/', reachable: 'no' }, ready: false });
  });

  it('keeps ready when the registry url is unknown or not http(s)', async () => {
    const result = await runPreflight({ run: scripted({ ...healthy, pnpmRegistry: ok('undefined') }), probe: async () => false });
    expect(result).toMatchObject({ registry: { url: null, reachable: 'unknown' }, ready: true });
  });

  it('reports git as optional information', async () => {
    const noGit = await runPreflight({ run: scripted({ ...healthy, gitVersion: missing, gitUserName: missing, gitUserEmail: missing }), probe: async () => true });
    expect(noGit).toMatchObject({ git: { found: false, identity: false }, ready: true });
    const noIdentity = await runPreflight({ run: scripted({ ...healthy, gitUserEmail: { code: 1, stdout: '' } }), probe: async () => true });
    expect(noIdentity).toMatchObject({ git: { found: true, identity: false }, ready: true });
  });
});

describe('createCommandRunner with a fake pnpm binary', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'fake-pnpm-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  async function installFakePnpm(version: string) {
    await mkdir(dir, { recursive: true });
    if (process.platform === 'win32') {
      await writeFile(path.join(dir, 'pnpm.cmd'), `@echo off\r\necho ${version}\r\n`);
    } else {
      const file = path.join(dir, 'pnpm');
      await writeFile(file, `#!/bin/sh\necho ${version}\n`);
      await chmod(file, 0o755);
    }
  }

  it('finds the pnpm that is first in PATH', async () => {
    await installFakePnpm('7.7.7');
    const run = createCommandRunner({ env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}` }, platform: process.platform });
    expect(await run('pnpmVersion')).toEqual({ code: 0, stdout: expect.stringContaining('7.7.7') });
  });

  it.skipIf(process.platform === 'win32')('reports a missing binary as not found', async () => {
    const run = createCommandRunner({ env: { PATH: dir }, platform: process.platform });
    expect(await run('pnpmVersion')).toEqual({ code: null, stdout: '' });
    const result = await runPreflight({ run, probe: async () => true });
    expect(result).toMatchObject({ pnpm: { found: false }, ready: false });
  });
});
