import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GenerateResult, GenerationState, ServerMessage } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { waitFor } from '../../test-utils/fixture';
import { nativeRealpath } from '../fs-paths';
import { GenerationRegistry } from '../generation';
import type { HostCommand } from '../../server/router';
import { WizardService, type WizardHost } from '../service';

const FAKE_BIN = fileURLToPath(new URL('../../test-utils/fake-harness.mjs', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../__fixtures__/init-output/', import.meta.url));
const cli = { bin: FAKE_BIN, version: '0.0.0-fake' };
const CONFIG = { mode: 'nx', project: { name: 'demo', packageScope: '@demo' } };

let home: string;
let outside: string;
let generationEnv: NodeJS.ProcessEnv;
beforeEach(async () => {
  home = await nativeRealpath(await mkdtemp(path.join(tmpdir(), 'wizard-home-')));
  outside = await nativeRealpath(await mkdtemp(path.join(tmpdir(), 'wizard-outside-')));
  generationEnv = { ...process.env };
});
afterEach(async () => {
  await Promise.all([home, outside].map((dir) => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })));
});

function setup(options: { cwd?: string; allowTargets?: string[]; reveal?: (target: string) => Promise<void> } = {}) {
  const events: ServerMessage[] = [];
  const finished = new Map<string, GenerationState>();
  const registry = new GenerationRegistry({
    broadcast: (message) => {
      events.push(message);
      if (message.kind === 'generation.status' && message.generation.status !== 'running') finished.set(message.generation.id, message.generation);
    },
    env: generationEnv,
    flushIntervalMs: 5,
    killGraceMs: 200,
  });
  const host: WizardHost = { generations: registry, allowTargets: options.allowTargets ?? [], runtime: null, switchProject: async (root) => ({ root, project: 'p' }) };
  const wizard = new WizardService(host, {
    cli,
    homeDir: home,
    cwd: options.cwd ?? home,
    preflight: async () => ({ node: { version: '20.0.0' }, pnpm: { found: true, version: '10' }, git: { found: true, identity: true }, registry: { url: null, reachable: 'unknown' }, ready: true }),
    reveal: options.reveal,
  });
  const service = { handle: (command: Record<string, unknown>) => wizard.handle({ kind: 'command', id: 'test', ...command } as HostCommand) };
  const generate = (target: string, extra: Record<string, unknown> = {}) =>
    service.handle({ cmd: 'wizard.generate', config: CONFIG, path: target, ...extra }) as Promise<GenerateResult>;
  const settled = (id: string) => waitFor(() => finished.get(id));
  return { service, registry, events, generate, settled };
}

describe('WizardService read commands', () => {
  it('serves the catalog with the constant init argv and the home as suggested parent when the cwd is outside the bases', async () => {
    const { service } = setup({ cwd: outside });
    const result = (await service.handle({ cmd: 'wizard.catalog' })) as { catalog: { cliVersion: string }; initArgv: string[]; home: string; suggestedParent: string; platform: string };
    expect(result.catalog.cliVersion).toBe('0.0.0-fake');
    expect(result.initArgv).toEqual(['harness', 'init', '--config', 'harness.config.json', '--here', '-y']);
    expect(result.home).toBe(home);
    expect(result.suggestedParent).toBe(home);
    expect(result.platform).toBe(process.platform === 'win32' ? 'win32' : 'posix');
  });

  it('suggests the cwd when it is inside an allowed base', async () => {
    const cwd = path.join(home, 'work');
    await mkdir(cwd);
    const result = (await setup({ cwd }).service.handle({ cmd: 'wizard.catalog' })) as { suggestedParent: string };
    expect(result.suggestedParent).toBe(cwd);
  });

  it('delegates preflight and validate', async () => {
    const { service } = setup();
    expect(await service.handle({ cmd: 'wizard.preflight' })).toMatchObject({ ready: true });
    expect(await service.handle({ cmd: 'wizard.validate', config: { __invalid: true } })).toMatchObject({ ok: false });
  });

  it('lists directories inside the bases and rejects the rest', async () => {
    await mkdir(path.join(home, 'alpha'));
    const { service } = setup();
    expect(await service.handle({ cmd: 'wizard.listDirs', showHidden: false })).toMatchObject({ path: home, entries: [{ name: 'alpha', symlink: false }] });
    await expect(service.handle({ cmd: 'wizard.listDirs', path: outside, showHidden: false })).rejects.toMatchObject({ code: 'bad-path' });
  });

  it('checks targets with the tolerated entries from the CLI catalog', async () => {
    const target = path.join(home, 'tolerated');
    await mkdir(target);
    await writeFile(path.join(target, 'README.md'), '');
    const { service } = setup({ allowTargets: [outside] });
    expect(await service.handle({ cmd: 'wizard.checkTarget', path: target })).toMatchObject({ state: 'tolerated', needsConfirmation: true });
    expect(await service.handle({ cmd: 'wizard.checkTarget', path: path.join(outside, 'x') })).toMatchObject({ state: 'missing' });
    expect(await service.handle({ cmd: 'wizard.checkTarget', path: path.join(path.dirname(home), 'elsewhere-x') })).toMatchObject({ state: 'outside-allowed' });
  });
});

describe('WizardService.generate', () => {
  it('returns invalid-config without touching the filesystem', async () => {
    const target = path.join(home, 'proj');
    const { service } = setup();
    const result = (await service.handle({ cmd: 'wizard.generate', config: { __invalid: true }, path: target })) as GenerateResult;
    expect(result).toMatchObject({ outcome: 'invalid-config', validation: { ok: false } });
    await expect(readFile(path.join(target, 'harness.config.json'))).rejects.toThrow();
  });

  it('blocks conflicting and outside targets', async () => {
    const busy = path.join(home, 'busy');
    await mkdir(busy);
    await writeFile(path.join(busy, 'package.json'), '{}');
    const { generate } = setup();
    expect(await generate(busy)).toMatchObject({ outcome: 'blocked', reason: 'content', check: { state: 'conflicting' } });
    expect(await generate(path.join(outside, 'x'))).toMatchObject({ outcome: 'blocked', check: { state: 'outside-allowed' } });
  });

  it('starts on a missing target, creating it and keeping the config', async () => {
    generationEnv = { ...generationEnv, FAKE_HARNESS_REPLAY: path.join(FIXTURES, 'nx-success.txt'), FAKE_HARNESS_CREATE_SDD: '1' };
    const target = path.join(home, 'a', 'b', 'proj');
    const { generate, settled } = setup();
    const result = await generate(target);
    if (result.outcome !== 'started') throw new Error(result.outcome);
    expect(result.generation).toMatchObject({ mode: 'nx', projectName: 'demo', status: 'running' });
    expect((await settled(result.generation.id)).status).toBe('succeeded');
    expect(JSON.parse(await readFile(path.join(target, 'harness.config.json'), 'utf8'))).toEqual(CONFIG);
  });

  it('requires the exact fingerprint of the current state for tolerated folders', async () => {
    generationEnv = { ...generationEnv, FAKE_HARNESS_REPLAY: path.join(FIXTURES, 'nx-success.txt'), FAKE_HARNESS_CREATE_SDD: '1' };
    const target = path.join(home, 'with-readme');
    await mkdir(target);
    await writeFile(path.join(target, 'README.md'), '');
    const { generate, service, settled } = setup();

    const first = await generate(target);
    if (first.outcome !== 'needs-confirmation') throw new Error(first.outcome);
    expect(first.check.fingerprint).toMatch(/^[0-9a-f]{16}$/);

    expect(await generate(target, { fingerprint: '0'.repeat(16) })).toMatchObject({ outcome: 'needs-confirmation' });

    await writeFile(path.join(target, '.git'), '');
    const changed = await service.handle({ cmd: 'wizard.checkTarget', path: target });
    expect((changed as { fingerprint: string }).fingerprint).not.toBe(first.check.fingerprint);
    expect(await generate(target, { fingerprint: first.check.fingerprint })).toMatchObject({ outcome: 'needs-confirmation' });

    const confirmed = await generate(target, { fingerprint: (changed as { fingerprint: string }).fingerprint });
    if (confirmed.outcome !== 'started') throw new Error(confirmed.outcome);
    await settled(confirmed.generation.id);
  });

  it('blocks a foreign harness.config.json as config-differs', async () => {
    const target = path.join(home, 'foreign');
    await mkdir(target);
    await writeFile(path.join(target, 'harness.config.json'), '{"mine":true}\n');
    const { generate } = setup();
    const first = await generate(target);
    if (first.outcome !== 'needs-confirmation') throw new Error(first.outcome);
    expect(await generate(target, { fingerprint: first.check.fingerprint })).toMatchObject({ outcome: 'blocked', reason: 'config-differs' });
    expect(await readFile(path.join(target, 'harness.config.json'), 'utf8')).toBe('{"mine":true}\n');
  });

  it('rejects a second generation with conflict naming the active path, and cancels the first through the service', async () => {
    const startedFile = path.join(home, 'started');
    generationEnv = { ...generationEnv, FAKE_HARNESS_MODE: 'init-hang', FAKE_HARNESS_INIT_STARTED: startedFile };
    const first = path.join(home, 'first');
    const { generate, service, settled } = setup();
    const started = await generate(first);
    if (started.outcome !== 'started') throw new Error(started.outcome);
    await waitFor(() => readFile(startedFile, 'utf8').catch(() => ''));

    await expect(generate(path.join(home, 'second'))).rejects.toMatchObject({ code: 'conflict', message: expect.stringContaining(first) });

    const snapshot = (await service.handle({ cmd: 'wizard.generation.get', sinceSeq: 0 })) as { generation: GenerationState | null };
    expect(snapshot.generation).toMatchObject({ id: started.generation.id, status: 'running' });

    const cancelled = (await service.handle({ cmd: 'wizard.generation.cancel', generationId: started.generation.id })) as GenerationState;
    expect(cancelled.status).toBe('cancelled');
    expect((await settled(started.generation.id)).status).toBe('cancelled');
    await expect(service.handle({ cmd: 'wizard.generation.cancel', generationId: started.generation.id })).rejects.toMatchObject({ code: 'conflict' });
    await expect(service.handle({ cmd: 'wizard.generation.cancel', generationId: 'unknown' })).rejects.toMatchObject({ code: 'not-found' });
  });
});

describe('WizardService generation.get and reveal', () => {
  it('resynchronizes from a seq and reports unknown ids', async () => {
    generationEnv = { ...generationEnv, FAKE_HARNESS_REPLAY: path.join(FIXTURES, 'nx-success.txt'), FAKE_HARNESS_CREATE_SDD: '1' };
    const { generate, service, settled } = setup();
    const result = await generate(path.join(home, 'proj'));
    if (result.outcome !== 'started') throw new Error(result.outcome);
    const final = await settled(result.generation.id);

    const all = (await service.handle({ cmd: 'wizard.generation.get', generationId: final.id, sinceSeq: 0 })) as { output: { seq: number }[]; generation: GenerationState };
    expect(all.generation.status).toBe('succeeded');
    expect(all.output.at(-1)!.seq).toBe(final.lastSeq);
    const tail = (await service.handle({ cmd: 'wizard.generation.get', generationId: final.id, sinceSeq: final.lastSeq })) as { output: unknown[] };
    expect(tail.output).toEqual([]);
    await expect(service.handle({ cmd: 'wizard.generation.get', generationId: 'unknown', sinceSeq: 0 })).rejects.toMatchObject({ code: 'not-found' });
  });

  it('reveals only the target of a known generation', async () => {
    generationEnv = { ...generationEnv, FAKE_HARNESS_REPLAY: path.join(FIXTURES, 'nx-success.txt'), FAKE_HARNESS_CREATE_SDD: '1' };
    const revealed: string[] = [];
    const { generate, service, settled } = setup({ reveal: async (target) => void revealed.push(target) });
    const result = await generate(path.join(home, 'proj'));
    if (result.outcome !== 'started') throw new Error(result.outcome);
    await settled(result.generation.id);
    expect(await service.handle({ cmd: 'wizard.reveal', generationId: result.generation.id })).toBeNull();
    expect(revealed).toEqual([result.generation.target]);
    await expect(service.handle({ cmd: 'wizard.reveal', generationId: 'unknown' })).rejects.toMatchObject({ code: 'not-found' });
  });
});
