import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTOCOL_VERSION, WS_CLOSE_WORKSPACE_SWITCHED, type ServerMessage } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { DEFAULT_ORIGINS, startBridge } from '../../main';
import { copyFixture, FIXTURE_ROOT, waitFor } from '../../test-utils/fixture';
import { nativeRealpath } from '../fs-paths';

const FAKE_BIN = fileURLToPath(new URL('../../test-utils/fake-harness.mjs', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../__fixtures__/init-output/', import.meta.url));
const FAKE_CLI = { bin: FAKE_BIN, version: '0.0.0-fake' };
const CONFIG = { mode: 'nx', project: { name: 'demo', packageScope: '@demo' } };
const FAKE_ENV = ['FAKE_HARNESS_REPLAY', 'FAKE_HARNESS_COPY_FROM', 'FAKE_HARNESS_CREATE_SDD', 'FAKE_HARNESS_MODE', 'FAKE_HARNESS_EXIT_CODE'] as const;

const cleanups: (() => Promise<void>)[] = [];
let sandbox: string;
beforeEach(async () => {
  sandbox = await nativeRealpath(await mkdtemp(path.join(tmpdir(), 'wizard-open-')));
  process.env['FAKE_HARNESS_REPLAY'] = path.join(FIXTURES, 'nx-success.txt');
  process.env['FAKE_HARNESS_COPY_FROM'] = FIXTURE_ROOT;
});
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
  for (const key of FAKE_ENV) delete process.env[key];
  await rm(sandbox, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function launcher() {
  const bridge = await startBridge({
    root: sandbox,
    port: 0,
    strictPort: true,
    engine: 'fake',
    allowedOrigins: DEFAULT_ORIGINS,
    webUrl: 'x',
    allowTargets: [sandbox],
    harnessCli: FAKE_CLI,
  });
  cleanups.push(bridge.close);
  return bridge;
}

async function connect(port: number, token: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const inbox: ServerMessage[] = [];
  ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
  await new Promise((resolve) => ws.once('open', resolve));
  ws.send(JSON.stringify({ kind: 'hello', token, protocolVersion: PROTOCOL_VERSION, clientVersion: 't' }));
  const welcome = (await waitFor(() => inbox.find((m) => m.kind === 'welcome'))) as Extract<ServerMessage, { kind: 'welcome' }>;
  let counter = 0;
  const call = async (cmd: Record<string, unknown>) => {
    const id = `c${++counter}`;
    ws.send(JSON.stringify({ kind: 'command', id, ...cmd }));
    return (await waitFor(() => inbox.find((m) => m.kind === 'result' && m.id === id))) as Extract<ServerMessage, { kind: 'result' }>;
  };
  cleanups.push(async () => ws.close());
  return { ws, inbox, welcome, call };
}

type Client = Awaited<ReturnType<typeof connect>>;

async function generateProject(client: Client, name: string): Promise<{ id: string; target: string }> {
  const target = path.join(sandbox, name);
  const result = await client.call({ cmd: 'wizard.generate', config: CONFIG, path: target });
  if (!result.ok) throw new Error(JSON.stringify(result));
  const generation = (result.data as { generation: { id: string } }).generation;
  await waitFor(() => client.inbox.find((m) => m.kind === 'generation.status' && m.generation.id === generation.id && m.generation.status !== 'running'));
  return { id: generation.id, target };
}

describe('workspace.open', () => {
  it('opens a generated project from the launcher, closes sockets with 4010 and welcomes the new root', async () => {
    const bridge = await launcher();
    const client = await connect(bridge.port, bridge.token);
    expect(client.welcome.workspace).toBeNull();
    const { id, target } = await generateProject(client, 'proj');
    const closed = new Promise<number>((resolve) => client.ws.once('close', resolve));

    const opened = await client.call({ cmd: 'workspace.open', generationId: id });
    expect(opened).toMatchObject({ ok: true, data: { root: await nativeRealpath(target), project: 'studio fixture' } });
    expect(await closed).toBe(WS_CLOSE_WORKSPACE_SWITCHED);
    expect(client.inbox.find((m) => m.kind === 'workspace.switched')).toMatchObject({ root: await nativeRealpath(target), project: 'studio fixture' });

    const next = await connect(bridge.port, bridge.token);
    expect(next.welcome.workspace).toEqual({ root: await nativeRealpath(target), project: 'studio fixture' });
    expect(await next.call({ cmd: 'thread.list', channelId: 'general' })).toMatchObject({ ok: true });
    expect(await next.call({ cmd: 'wizard.generation.get', sinceSeq: 0 })).toMatchObject({ ok: true, data: { generation: { id, status: 'succeeded', hasSdd: true } } });
  });

  it('answers not-found for unknown generations and for generations without sdd/', async () => {
    process.env['FAKE_HARNESS_EXIT_CODE'] = '1';
    delete process.env['FAKE_HARNESS_COPY_FROM'];
    process.env['FAKE_HARNESS_REPLAY'] = path.join(FIXTURES, 'standalone-network-failure.txt');
    const bridge = await launcher();
    const client = await connect(bridge.port, bridge.token);
    expect(await client.call({ cmd: 'workspace.open', generationId: 'unknown' })).toMatchObject({ ok: false, error: { code: 'not-found' } });
    const { id } = await generateProject(client, 'failed');
    expect(await client.call({ cmd: 'workspace.open', generationId: id })).toMatchObject({ ok: false, error: { code: 'not-found' } });
    expect(bridge.host.runtime).toBeNull();
  });

  it('answers conflict while the generation is still running', async () => {
    process.env['FAKE_HARNESS_MODE'] = 'init-hang';
    const startedFile = path.join(sandbox, 'started');
    process.env['FAKE_HARNESS_INIT_STARTED'] = startedFile;
    cleanups.push(async () => void delete process.env['FAKE_HARNESS_INIT_STARTED']);
    const bridge = await launcher();
    const client = await connect(bridge.port, bridge.token);
    const result = await client.call({ cmd: 'wizard.generate', config: CONFIG, path: path.join(sandbox, 'running') });
    if (!result.ok) throw new Error(result.error.message);
    const id = (result.data as { generation: { id: string } }).generation.id;
    expect(await client.call({ cmd: 'workspace.open', generationId: id })).toMatchObject({ ok: false, error: { code: 'conflict' } });
    expect(await client.call({ cmd: 'wizard.generation.cancel', generationId: id })).toMatchObject({ ok: true, data: { status: 'cancelled' } });
  });

  it('rejects the switch with conflict while agents are working in project mode, and succeeds once idle', async () => {
    const current = await copyFixture();
    cleanups.push(current.cleanup);
    const bridge = await startBridge({
      root: current.root,
      port: 0,
      strictPort: true,
      engine: 'fake',
      allowedOrigins: DEFAULT_ORIGINS,
      webUrl: 'x',
      allowTargets: [sandbox],
      harnessCli: FAKE_CLI,
    });
    cleanups.push(bridge.close);
    const client = await connect(bridge.port, bridge.token);
    const { id, target } = await generateProject(client, 'proj');
    const runtime = bridge.host.runtime!;
    const busy = vi.spyOn(runtime, 'isBusy').mockReturnValue(true);

    const rejected = await client.call({ cmd: 'workspace.open', generationId: id });
    expect(rejected).toMatchObject({ ok: false, error: { code: 'conflict', message: expect.stringContaining('studio fixture') } });
    expect(bridge.host.runtime).toBe(runtime);
    expect(client.inbox.some((m) => m.kind === 'workspace.switched')).toBe(false);

    busy.mockReturnValue(false);
    expect(await client.call({ cmd: 'workspace.open', generationId: id })).toMatchObject({ ok: true, data: { root: await nativeRealpath(target) } });
    expect(bridge.host.runtime).not.toBe(runtime);
  });

  it('switches repeatedly without growing watchers or handles', async () => {
    const other = await copyFixture();
    cleanups.push(other.cleanup);
    const bridge = await launcher();
    const client = await connect(bridge.port, bridge.token);
    const { id } = await generateProject(client, 'proj');
    const resources = () => {
      const counts = new Map<string, number>();
      for (const type of process.getActiveResourcesInfo()) if (!['Timeout', 'Immediate', 'TickObject'].includes(type)) counts.set(type, (counts.get(type) ?? 0) + 1);
      return Object.fromEntries([...counts].sort());
    };
    expect(await client.call({ cmd: 'workspace.open', generationId: id })).toMatchObject({ ok: true });
    const generated = bridge.host.runtime!.root;
    const otherRoot = await nativeRealpath(other.root);
    const cycle = async () => {
      await bridge.host.switchProject(otherRoot);
      await bridge.host.switchProject(generated);
    };
    await cycle();
    await cycle();
    const baseline = resources();
    for (let i = 0; i < 6; i++) await cycle();
    expect(resources()).toEqual(baseline);
  });
});
