import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTOCOL_VERSION, WS_CLOSE_WORKSPACE_SWITCHED, type ServerMessage } from '@sdd-studio/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { DEFAULT_ORIGINS, startBridge } from './main';
import { copyFixture, waitFor } from './test-utils/fixture';

const FAKE_CLI = { bin: fileURLToPath(new URL('./test-utils/fake-harness.mjs', import.meta.url)), version: '0.0.0-fake' };

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

async function emptyDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'launcher-'));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

async function connect(port: number, token: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const inbox: ServerMessage[] = [];
  ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
  await new Promise((resolve) => ws.once('open', resolve));
  ws.send(JSON.stringify({ kind: 'hello', token, protocolVersion: PROTOCOL_VERSION, clientVersion: 't' }));
  const welcome = (await waitFor(() => inbox.find((m) => m.kind === 'welcome'))) as Extract<ServerMessage, { kind: 'welcome' }>;
  const call = async (cmd: Record<string, unknown>) => {
    const id = `c${inbox.length}-${Math.random()}`;
    ws.send(JSON.stringify({ kind: 'command', id, ...cmd }));
    return (await waitFor(() => inbox.find((m) => m.kind === 'result' && m.id === id))) as Extract<ServerMessage, { kind: 'result' }>;
  };
  return { ws, inbox, welcome, call };
}

describe('launcher mode', () => {
  it('handshakes with workspace null and answers project commands with not-found', async () => {
    const bridge = await startBridge({ root: await emptyDir(), port: 0, strictPort: true, engine: 'fake', allowedOrigins: DEFAULT_ORIGINS, webUrl: 'x', harnessCli: FAKE_CLI });
    cleanups.push(bridge.close);
    const client = await connect(bridge.port, bridge.token);
    expect(client.welcome.workspace).toBeNull();
    expect(client.welcome.kitVersion).toBeNull();
    expect(client.welcome.features).toContain('project-wizard');
    expect(await client.call({ cmd: 'thread.list', channelId: 'general' })).toMatchObject({ ok: false, error: { code: 'not-found' } });
    expect(await client.call({ cmd: 'workspace.snapshot' })).toMatchObject({ ok: false, error: { code: 'not-found' } });
    expect(await client.call({ cmd: 'presence.get' })).toMatchObject({ ok: true, data: [] });
    expect(await client.call({ cmd: 'auth.status' })).toMatchObject({ ok: true });
    expect(await client.call({ cmd: 'wizard.catalog' })).toMatchObject({ ok: true, data: { catalog: { cliVersion: '0.0.0-fake' }, initArgv: ['harness', 'init', '--config', 'harness.config.json', '--here', '-y'] } });
    client.ws.close();
  });
});

describe('BridgeHost project switching', () => {
  it('opens a project after launching, closes sockets with 4010 and welcomes the new root', async () => {
    const { root, cleanup } = await copyFixture();
    cleanups.push(cleanup);
    const bridge = await startBridge({ root: await emptyDir(), port: 0, strictPort: true, engine: 'fake', allowedOrigins: DEFAULT_ORIGINS, webUrl: 'x' });
    cleanups.push(bridge.close);
    const first = await connect(bridge.port, bridge.token);
    expect(first.welcome.workspace).toBeNull();
    const closed = new Promise<number>((resolve) => first.ws.once('close', resolve));
    await bridge.host.openProject(root);
    bridge.host.announceSwitched();
    expect(await closed).toBe(WS_CLOSE_WORKSPACE_SWITCHED);
    expect(first.inbox.find((m) => m.kind === 'workspace.switched')).toMatchObject({ project: 'studio fixture' });
    const second = await connect(bridge.port, bridge.token);
    expect(second.welcome.workspace?.project).toBe('studio fixture');
    expect(await second.call({ cmd: 'thread.list', channelId: 'general' })).toMatchObject({ ok: true });
    second.ws.close();
  });

  it('switches repeatedly without leaving runtimes open and close() is idempotent', async () => {
    const first = await copyFixture();
    const second = await copyFixture();
    cleanups.push(first.cleanup, second.cleanup);
    const bridge = await startBridge({ root: first.root, port: 0, strictPort: true, engine: 'fake', allowedOrigins: DEFAULT_ORIGINS, webUrl: 'x' });
    expect(bridge.host.runtime!.isBusy()).toBe(false);
    const opened = [bridge.host.runtime!];
    for (let i = 0; i < 4; i++) opened.push(await bridge.host.openProject(i % 2 === 0 ? second.root : first.root));
    const closings = opened.slice(0, -1).map((runtime) => runtime.close());
    await Promise.all(closings);
    await bridge.close();
    await bridge.close();
    await Promise.all(opened.map((runtime) => runtime.close()));
    expect(bridge.host.runtime).toBeNull();
  });
});
