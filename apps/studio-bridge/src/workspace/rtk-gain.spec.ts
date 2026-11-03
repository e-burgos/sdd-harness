import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RtkGain } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRtkGainReader, findRtkBinary, parseRtkVersion, RTK_CACHE_MS, RTK_GAIN_TIMEOUT_MS, type RunRtk } from './rtk-gain';

const GAIN = { summary: { saved_tokens: 12 }, daily: [] };

describe('parseRtkVersion', () => {
  it('extracts the semver from rtk output', () => {
    expect(parseRtkVersion('rtk 0.48.0\n')).toBe('0.48.0');
  });
  it('rejects output from another binary', () => {
    expect(parseRtkVersion('other 1.2.3')).toBeNull();
  });
});

describe('createRtkGainReader', () => {
  let clock: number;
  beforeEach(() => {
    clock = 1_000_000;
  });
  const make = (run: RunRtk | ReturnType<typeof vi.fn>, binary: string | null = '/bin/rtk') =>
    createRtkGainReader({ findBinary: () => binary, run: run as RunRtk, now: () => clock });
  const okRun = () =>
    vi.fn(async (_b: string, args: string[]) => ({ stdout: args[0] === '--version' ? 'rtk 0.48.0' : JSON.stringify(GAIN), stderr: '' }));

  it('returns the parsed gain and version, valid against the protocol schema', async () => {
    const result = await make(okRun())('/repo');
    expect(result).toMatchObject({ status: 'ok', version: '0.48.0', gain: GAIN });
    expect(RtkGain.safeParse(result).success).toBe(true);
  });

  it('runs the gain command with the documented args, cwd and 8 s timeout', async () => {
    const run = okRun();
    await make(run)('/repo');
    expect(run).toHaveBeenCalledWith('/bin/rtk', ['gain', '--project', '--all', '--format', 'json'], '/repo', RTK_GAIN_TIMEOUT_MS);
    expect(RTK_GAIN_TIMEOUT_MS).toBe(8000);
  });

  it('reports not-installed without running anything when the binary is missing', async () => {
    const run = okRun();
    const result = await make(run, null)('/repo');
    expect(result).toMatchObject({ status: 'not-installed', version: null, gain: null });
    expect(run).not.toHaveBeenCalled();
  });

  it('reports error when the gain command fails, keeping the version', async () => {
    const run = vi.fn(async (_b: string, args: string[]) => {
      if (args[0] === '--version') return { stdout: 'rtk 0.48.0', stderr: '' };
      throw new Error('timeout');
    });
    expect(await make(run)('/repo')).toMatchObject({ status: 'error', version: '0.48.0', gain: null });
  });

  it('reports error on invalid JSON or non-object JSON', async () => {
    const bad = vi.fn(async (_b: string, args: string[]) => ({ stdout: args[0] === '--version' ? 'rtk 1.0.0' : 'not json', stderr: '' }));
    expect((await make(bad)('/repo')).status).toBe('error');
    const arr = vi.fn(async (_b: string, args: string[]) => ({ stdout: args[0] === '--version' ? 'rtk 1.0.0' : '[]', stderr: '' }));
    expect((await make(arr)('/repo')).status).toBe('error');
  });

  it('keeps status ok when rtk prints warnings on stderr', async () => {
    const run = vi.fn(async (_b: string, args: string[]) => ({
      stdout: args[0] === '--version' ? 'rtk 0.48.0' : JSON.stringify(GAIN),
      stderr: 'update available',
    }));
    expect(await make(run)('/repo')).toMatchObject({ status: 'ok', version: '0.48.0', gain: GAIN });
  });

  it('survives a failing --version probe', async () => {
    const run = vi.fn(async (_b: string, args: string[]) => {
      if (args[0] === '--version') throw new Error('nope');
      return { stdout: JSON.stringify(GAIN), stderr: '' };
    });
    expect(await make(run)('/repo')).toMatchObject({ status: 'ok', version: null });
  });

  it('serves from cache within 10 s and refreshes after', async () => {
    const run = okRun();
    const read = make(run);
    const first = await read('/repo');
    clock += RTK_CACHE_MS - 1;
    expect(await read('/repo')).toBe(first);
    const calls = run.mock.calls.length;
    clock += 2;
    await read('/repo');
    expect(run.mock.calls.length).toBeGreaterThan(calls);
  });

  it('caches per workspace root', async () => {
    const run = okRun();
    const read = make(run);
    await read('/a');
    await read('/b');
    expect(run.mock.calls.filter(([, args]) => args[0] === 'gain')).toHaveLength(2);
  });
});

describe('findRtkBinary', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'sdd-rtk-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const touch = async (file: string) => {
    await writeFile(file, '#!/bin/sh\n');
    await chmod(file, 0o755);
  };

  it('prefers RTK_BIN, then PATH, then the install dir', async () => {
    const bin = path.join(dir, 'custom-rtk');
    const onPath = path.join(dir, 'rtk');
    await touch(bin);
    await touch(onPath);
    expect(findRtkBinary({ RTK_BIN: bin, PATH: dir }, 'linux')).toBe(bin);
    expect(findRtkBinary({ PATH: dir }, 'linux')).toBe(onPath);
    expect(findRtkBinary({ PATH: '/nonexistent', RTK_INSTALL_DIR: dir }, 'linux')).toBe(onPath);
  });

  it('returns null when nothing is found', () => {
    expect(findRtkBinary({ PATH: '/nonexistent', RTK_INSTALL_DIR: path.join(dir, 'empty') }, 'linux')).toBeNull();
  });
});
