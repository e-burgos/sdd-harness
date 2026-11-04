import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GenerationState, ServerMessage } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { waitFor } from '../../test-utils/fixture';
import { nativeRealpath } from '../fs-paths';
import { GenerationRegistry, INIT_ARGV, prepareTarget, type GenerationRegistryOptions } from '../generation';

const FAKE_BIN = fileURLToPath(new URL('../../test-utils/fake-harness.mjs', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../__fixtures__/init-output/', import.meta.url));
const cli = { bin: FAKE_BIN, version: '0.0.0-fake' };
const CONFIG = { mode: 'nx', project: { name: 'demo', packageScope: '@demo' }, apps: [] };

let dir: string;
let target: string;
beforeEach(async () => {
  dir = await nativeRealpath(await mkdtemp(path.join(tmpdir(), 'generation-')));
  target = path.join(dir, 'new', 'demo');
  await writeFile(path.join(dir, 'log'), '');
});
afterEach(() => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

const fixture = (name: string) => path.join(FIXTURES, name);

function harness(env: NodeJS.ProcessEnv = {}, options: Partial<GenerationRegistryOptions> = {}) {
  const events: ServerMessage[] = [];
  let settle!: (state: GenerationState) => void;
  const finished = new Promise<GenerationState>((resolve) => {
    settle = resolve;
  });
  const registry = new GenerationRegistry({
    broadcast: (message) => {
      events.push(message);
      if (message.kind === 'generation.status' && message.generation.status !== 'running') settle(message.generation);
    },
    env: { ...process.env, FAKE_HARNESS_LOG: path.join(dir, 'log'), ...env },
    flushIntervalMs: 5,
    ...options,
  });
  const start = (mode: 'nx' | 'standalone' = 'nx', config: Record<string, unknown> = CONFIG) =>
    registry.start({ cli, config, target, mode, projectName: 'demo' });
  return { registry, events, finished, start };
}

const logged = () =>
  readFileSync(path.join(dir, 'log'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

const stageStatuses = (state: GenerationState) => state.stages.map((entry) => `${entry.stage}:${entry.status}`);
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe('prepareTarget', () => {
  it('creates the missing directories one by one and writes the config exactly', async () => {
    expect(await prepareTarget(target, CONFIG)).toBe('ready');
    expect(await readFile(path.join(target, 'harness.config.json'), 'utf8')).toBe(`${JSON.stringify(CONFIG, null, 2)}\n`);
  });

  it('keeps an identical config and refuses a different one without touching it', async () => {
    await prepareTarget(target, CONFIG);
    expect(await prepareTarget(target, CONFIG)).toBe('ready');
    const before = await readFile(path.join(target, 'harness.config.json'), 'utf8');
    expect(await prepareTarget(target, { ...CONFIG, mode: 'standalone' })).toBe('config-differs');
    expect(await readFile(path.join(target, 'harness.config.json'), 'utf8')).toBe(before);
  });

  it('fails when an ancestor is a file', async () => {
    await writeFile(path.join(dir, 'new'), 'file');
    await expect(prepareTarget(target, CONFIG)).rejects.toThrow();
  });
});

describe('GenerationRegistry.start', () => {
  it('runs the pinned CLI in the target with a constant argv and a scrubbed env, and keeps the config', async () => {
    const { start, finished, events } = harness({
      FAKE_HARNESS_REPLAY: fixture('nx-success.txt'),
      FAKE_HARNESS_CREATE_SDD: '1',
      ANTHROPIC_API_KEY: 'sk-secret',
      CI: 'true',
    });
    const started = await start();
    expect(started).toMatchObject({ outcome: 'started', generation: { status: 'running', target, argv: [...INIT_ARGV], cliVersion: '0.0.0-fake' } });

    const final = await finished;
    expect(final).toMatchObject({ status: 'succeeded', exitCode: 0, failure: null, hasSdd: true, gate: { validate: 'pass', build: 'pass' } });
    expect(stageStatuses(final)).toEqual(['prepare:done', 'scaffold:done', 'install:done', 'generate:done', 'validate:done', 'build:done']);
    expect(final.finishedAt).not.toBeNull();

    const [launch, ran] = logged() as [{ argv: string[]; env: Record<string, string | null> }, { cwd: string; config: string }];
    expect(launch.argv).toEqual(['init', '--config', 'harness.config.json', '--here', '-y']);
    expect(launch.env).toEqual({ ANTHROPIC_API_KEY: null, CI: null, NX_DAEMON: 'false' });
    expect(await nativeRealpath(ran.cwd)).toBe(target);
    expect(ran.config).toBe(`${JSON.stringify(CONFIG, null, 2)}\n`);
    expect(await readFile(path.join(target, 'harness.config.json'), 'utf8')).toBe(ran.config);

    const seqs = events.filter((e) => e.kind === 'generation.output').map((e) => (e as Extract<ServerMessage, { kind: 'generation.output' }>).seq);
    expect(seqs.length).toBeGreaterThan(0);
    expect(seqs).toEqual(seqs.map((_, index) => index + 1));
    expect(final.lastSeq).toBe(seqs.at(-1));
  });

  it('classifies a successful standalone run', async () => {
    const { start, finished } = harness({ FAKE_HARNESS_REPLAY: fixture('standalone-success.txt'), FAKE_HARNESS_CREATE_SDD: '1' });
    await start('standalone');
    const final = await finished;
    expect(final.status).toBe('succeeded');
    expect(final.gate).toEqual({ validate: 'pass', build: 'pass' });
  });

  it('maps a red gate to gate-failed while keeping the generated sdd/', async () => {
    const { start, finished } = harness({ FAKE_HARNESS_REPLAY: fixture('nx-gate-red.txt'), FAKE_HARNESS_EXIT_CODE: '1', FAKE_HARNESS_CREATE_SDD: '1' });
    await start();
    const final = await finished;
    expect(final).toMatchObject({ status: 'gate-failed', exitCode: 1, hasSdd: true, gate: { validate: 'pass', build: 'fail' } });
    expect(final.failure).toMatchObject({ stage: 'build', kind: 'gate' });
    expect(final.failure?.message).toContain('nx run-many -t lint test build');
    expect(stageStatuses(final)).toEqual(['prepare:done', 'scaffold:done', 'install:done', 'generate:done', 'validate:done', 'build:failed']);
  });

  it('maps exit 0 without the gate marks to gate-failed', async () => {
    const { start, finished } = harness({ FAKE_HARNESS_STDERR: 'nothing useful\n' });
    await start();
    const final = await finished;
    expect(final).toMatchObject({ status: 'gate-failed', exitCode: 0 });
    expect(final.failure).toMatchObject({ kind: 'gate', stage: 'validate' });
  });

  it.each([
    ['standalone-network-failure.txt', 'network'],
    ['standalone-pnpm-missing.txt', 'pnpm-missing'],
  ] as const)('maps %s to a failure before the gate with kind %s', async (file, kind) => {
    const { start, finished } = harness({ FAKE_HARNESS_REPLAY: fixture(file), FAKE_HARNESS_EXIT_CODE: '1' });
    await start('standalone');
    const final = await finished;
    expect(final).toMatchObject({ status: 'failed', exitCode: 1, hasSdd: false });
    expect(final.failure).toMatchObject({ stage: 'install', kind });
    expect(stageStatuses(final)).toContain('install:failed');
    expect(stageStatuses(final).slice(-3)).toEqual(['generate:skipped', 'validate:skipped', 'build:skipped']);
  });

  it('maps an unclassified exit before the gate to a generic cli failure', async () => {
    const { start, finished } = harness({ FAKE_HARNESS_EXIT_CODE: '7' });
    await start();
    const final = await finished;
    expect(final).toMatchObject({ status: 'failed', exitCode: 7 });
    expect(final.failure).toMatchObject({ stage: 'scaffold', kind: 'cli' });
  });

  it.skipIf(process.platform === 'win32')('maps a signal death without a cancellation to interrupted', async () => {
    const { start, finished } = harness({ FAKE_HARNESS_SELF_KILL: '1' });
    await start();
    const final = await finished;
    expect(final).toMatchObject({ status: 'interrupted', exitCode: null });
    expect(final.failure).toMatchObject({ kind: 'signal' });
  });

  it('reports a prepare failure without launching the CLI', async () => {
    await writeFile(path.join(dir, 'new'), 'file');
    const { start, events } = harness();
    const result = await start();
    expect(result).toMatchObject({ outcome: 'started', generation: { status: 'failed', failure: { stage: 'prepare', kind: 'prepare' } } });
    expect(logged()).toEqual([]);
    expect(events.filter((e) => e.kind === 'generation.status')).toHaveLength(1);
  });

  it('answers config-differs and never launches over a foreign config', async () => {
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, 'harness.config.json'), '{"mine":true}\n');
    const { start, registry } = harness();
    expect(await start()).toEqual({ outcome: 'config-differs' });
    expect(await readFile(path.join(target, 'harness.config.json'), 'utf8')).toBe('{"mine":true}\n');
    expect(logged()).toEqual([]);
    expect(registry.activeTarget()).toBeNull();
  });

  it('rejects a second generation while one is active and accepts one after it finishes', async () => {
    const gate = path.join(dir, 'gate');
    const { start, finished, registry } = harness({ FAKE_HARNESS_INIT_GATE: gate, FAKE_HARNESS_INIT_STARTED: path.join(dir, 'started') });
    await start();
    await waitFor(() => readFile(path.join(dir, 'started'), 'utf8').catch(() => ''));
    await expect(start()).rejects.toMatchObject({ code: 'conflict', message: expect.stringContaining(target) });
    expect(registry.activeTarget()).toBe(target);
    await writeFile(gate, '');
    await finished;
    expect(registry.activeTarget()).toBeNull();
    expect(registry.find((await finished).id)).toMatchObject({ status: 'gate-failed' });
    await expect(registry.start({ cli, config: CONFIG, target, mode: 'nx', projectName: 'demo' })).resolves.toMatchObject({ outcome: 'started' });
    await registry.closeAll();
  });
});

describe('cancellation', () => {
  it('kills the whole process group and leaves the generation cancelled', async () => {
    const pidFile = path.join(dir, 'grandchild.pid');
    const startedFile = path.join(dir, 'started');
    const { start, registry } = harness(
      { FAKE_HARNESS_MODE: 'init-hang', FAKE_HARNESS_GRANDCHILD_PID_FILE: pidFile, FAKE_HARNESS_INIT_STARTED: startedFile },
      { killGraceMs: 200 },
    );
    const started = await start();
    if (started.outcome !== 'started') throw new Error('not started');
    await waitFor(() => readFile(startedFile, 'utf8').catch(() => ''));
    const grandchildPid = Number(await waitFor(() => readFile(pidFile, 'utf8').catch(() => '')));
    expect(alive(grandchildPid)).toBe(true);

    const cancelled = await registry.cancel(started.generation.id);
    expect(cancelled).toMatchObject({ status: 'cancelled', failure: { kind: 'cancelled' } });
    expect(cancelled.stages.map((s) => s.status)).not.toContain('active');
    await waitFor(() => !alive(grandchildPid));
    await expect(registry.cancel(started.generation.id)).rejects.toMatchObject({ code: 'conflict' });
    expect(await readFile(path.join(target, 'harness.config.json'), 'utf8')).toContain('"demo"');
  });

  it('rejects cancelling an unknown generation', async () => {
    await expect(harness().registry.cancel('nope')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('closeAll cancels the active generation', async () => {
    const startedFile = path.join(dir, 'started');
    const { start, registry, finished } = harness({ FAKE_HARNESS_MODE: 'init-hang', FAKE_HARNESS_INIT_STARTED: startedFile }, { killGraceMs: 200 });
    await start();
    await waitFor(() => readFile(startedFile, 'utf8').catch(() => ''));
    await registry.closeAll();
    expect((await finished).status).toBe('cancelled');
  });
});

describe('GenerationRegistry.get', () => {
  it('returns an empty snapshot before any generation and not-found for unknown ids', () => {
    const { registry } = harness();
    expect(registry.get(undefined, 0)).toEqual({ generation: null, output: [], truncatedBefore: false, hasMore: false });
    expect(() => registry.get('missing', 0)).toThrowError(expect.objectContaining({ code: 'not-found' }));
  });

  it('serves chunks after a given seq for the last generation', async () => {
    const { start, finished, registry } = harness({ FAKE_HARNESS_REPLAY: fixture('nx-success.txt'), FAKE_HARNESS_CREATE_SDD: '1' });
    await start();
    const final = await finished;
    const all = registry.get(undefined, 0);
    expect(all.generation?.id).toBe(final.id);
    expect(all.hasMore).toBe(false);
    expect(all.truncatedBefore).toBe(false);
    expect(all.output.map((c) => c.chunk).join('')).toContain('FASE 3 gate');
    expect(all.output.map((c) => c.seq)).toEqual(all.output.map((_, i) => i + 1));
    const tail = registry.get(final.id, final.lastSeq - 1);
    expect(tail.output).toHaveLength(1);
    expect(registry.get(final.id, final.lastSeq).output).toEqual([]);
  });

  it('drops the oldest chunks past the ring size and flags the gap', async () => {
    const { start, finished, registry } = harness({ FAKE_HARNESS_FLOOD_KIB: '200' }, { ringBytes: 64 * 1024 });
    await start();
    const final = await finished;
    const snapshot = registry.get(final.id, 0);
    expect(snapshot.truncatedBefore).toBe(true);
    expect(snapshot.output[0]!.seq).toBeGreaterThan(1);
    expect(snapshot.output.at(-1)!.seq).toBe(final.lastSeq);
    expect(snapshot.output.reduce((sum, c) => sum + c.chunk.length, 0)).toBeLessThanOrEqual(64 * 1024 + 32 * 1024);
    expect(registry.get(final.id, snapshot.output[0]!.seq - 1).truncatedBefore).toBe(false);
  });

  it('paginates with hasMore when the retained output exceeds one frame', async () => {
    const { start, finished, registry } = harness({ FAKE_HARNESS_FLOOD_KIB: '1600' });
    await start();
    const final = await finished;
    const first = registry.get(final.id, 0);
    expect(first.hasMore).toBe(true);
    expect(first.truncatedBefore).toBe(false);
    const second = registry.get(final.id, first.output.at(-1)!.seq);
    expect(second.output[0]!.seq).toBe(first.output.at(-1)!.seq + 1);
    const seen = new Set([...first.output, ...second.output].map((c) => c.seq));
    expect(seen.size).toBe(first.output.length + second.output.length);
    let last = second;
    while (last.hasMore) last = registry.get(final.id, last.output.at(-1)!.seq);
    expect(last.output.at(-1)!.seq).toBe(final.lastSeq);
  });
});
