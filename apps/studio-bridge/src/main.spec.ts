import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PROTOCOL_VERSION, defaultThreadOptions, type ServerMessage } from '@sdd-studio/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { detectAuthMode } from './auth-mode';
import { BridgeStartError, DEFAULT_ORIGINS, startBridge } from './main';
import { copyFixture, waitFor } from './test-utils/fixture';
import { BRIDGE_VERSION } from './version';

const watchers = vi.hoisted(() => [] as { close: () => Promise<void> }[]);
vi.mock('./workspace/watcher', async (orig) => {
  const mod = await orig<typeof import('./workspace/watcher')>();
  return {
    ...mod,
    startWorkspaceWatcher: async (...a: Parameters<typeof mod.startWorkspaceWatcher>) => {
      const w = await mod.startWorkspaceWatcher(...a);
      const close = vi.spyOn(w, 'close');
      watchers.push({ close: async () => undefined, spy: close } as never);
      return w;
    },
  };
});

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

describe('startBridge', () => {
  it('serves the local UI and returns a loopback URL when localUiDir is set', async () => {
    const { root, cleanup } = await copyFixture();
    cleanups.push(cleanup);
    const web = await mkdtemp(path.join(tmpdir(), 'web-'));
    cleanups.push(() => rm(web, { recursive: true, force: true }));
    await mkdir(path.join(web, 'w'), { recursive: true });
    await writeFile(path.join(web, 'w', 'index.html'), '<h1>ws</h1>');
    const bridge = await startBridge({ root, port: 0, strictPort: true, engine: 'fake', allowedOrigins: DEFAULT_ORIGINS, webUrl: 'x', localUiDir: web });
    cleanups.push(bridge.close);
    expect(bridge.url).toBe(`http://127.0.0.1:${bridge.port}/w/#bridge=${bridge.port}&token=${bridge.token}`);
    expect(await (await fetch(`http://127.0.0.1:${bridge.port}/w/`)).text()).toBe('<h1>ws</h1>');
  });
  it('refuses a localUiDir without w/index.html', async () => {
    const { root, cleanup } = await copyFixture();
    cleanups.push(cleanup);
    const web = await mkdtemp(path.join(tmpdir(), 'web-'));
    cleanups.push(() => rm(web, { recursive: true, force: true }));
    await expect(
      startBridge({ root, port: 0, strictPort: true, engine: 'fake', allowedOrigins: [], webUrl: 'x', localUiDir: web }),
    ).rejects.toBeInstanceOf(BridgeStartError);
  });
  it('serves the fixture end to end with the fake engine', async () => {
    const { root, cleanup } = await copyFixture();
    cleanups.push(cleanup);
    const bridge = await startBridge({
      root, port: 0, strictPort: true, engine: 'fake', allowedOrigins: DEFAULT_ORIGINS, webUrl: 'https://example.test/',
    });
    cleanups.push(bridge.close);
    expect(bridge.url).toBe(`https://example.test/w#bridge=${bridge.port}&token=${bridge.token}`);
    expect(bridge.project).toBe('studio fixture');

    const ws = new WebSocket(`ws://127.0.0.1:${bridge.port}`);
    const inbox: ServerMessage[] = [];
    ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
    await new Promise((r) => ws.once('open', r));
    ws.send(JSON.stringify({ kind: 'hello', token: bridge.token, protocolVersion: PROTOCOL_VERSION, clientVersion: 't' }));
    await waitFor(() => inbox.find((m) => m.kind === 'welcome'));
    ws.send(JSON.stringify({ kind: 'command', id: '1', cmd: 'thread.create', channelId: 'general', options: defaultThreadOptions(), text: 'hola' }));
    await waitFor(() => inbox.find((m) => m.kind === 'thread.event' && m.event.type === 'turn.end'));
    ws.close();
  });

  it('refuses a folder without sdd/', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'no-sdd-'));
    cleanups.push(() => rm(dir, { recursive: true, force: true }));
    await expect(
      startBridge({ root: dir, port: 0, strictPort: true, engine: 'fake', allowedOrigins: [], webUrl: 'x' }),
    ).rejects.toBeInstanceOf(BridgeStartError);
  });
});

describe('startBridge root resolution (M5)', () => {
  it('uses the physical path of a symlinked root', async () => {
    const { root, cleanup } = await copyFixture();
    cleanups.push(cleanup);
    const linkDir = await mkdtemp(path.join(tmpdir(), 'link-'));
    cleanups.push(() => rm(linkDir, { recursive: true, force: true }));
    const link = path.join(linkDir, 'repo');
    await symlink(root, link);
    const bridge = await startBridge({ root: link, port: 0, strictPort: true, engine: 'fake', allowedOrigins: DEFAULT_ORIGINS, webUrl: 'x' });
    cleanups.push(bridge.close);
    const ws = new WebSocket(`ws://127.0.0.1:${bridge.port}`);
    const inbox: ServerMessage[] = [];
    ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
    await new Promise((r) => ws.once('open', r));
    ws.send(JSON.stringify({ kind: 'hello', token: bridge.token, protocolVersion: PROTOCOL_VERSION, clientVersion: 't' }));
    const welcome = (await waitFor(() => inbox.find((m) => m.kind === 'welcome'))) as Extract<ServerMessage, { kind: 'welcome' }>;
    expect(welcome.workspace.root).toBe(await realpath(root));
    ws.close();
  });
});

describe('startBridge partial start', () => {
  it('closes the watcher when listen fails', async () => {
    const { root, cleanup } = await copyFixture();
    cleanups.push(cleanup);
    const blocker = createServer();
    await new Promise<void>((r) => blocker.listen(0, '127.0.0.1', r));
    cleanups.push(() => new Promise<void>((r) => blocker.close(() => r())));
    const port = (blocker.address() as { port: number }).port;
    watchers.length = 0;
    await expect(
      startBridge({ root, port, strictPort: true, engine: 'fake', allowedOrigins: [], webUrl: 'x' }),
    ).rejects.toMatchObject({ code: 'EADDRINUSE' });
    expect(watchers).toHaveLength(1);
    expect((watchers[0] as unknown as { spy: { mock: { calls: unknown[] } } }).spy.mock.calls).toHaveLength(1);
  });
});

describe('detectAuthMode', () => {
  it('uses the API key when present, the local login otherwise', () => {
    expect(detectAuthMode({ ANTHROPIC_API_KEY: 'k' })).toBe('api-key');
    expect(detectAuthMode({})).toBe('local-claude-login');
  });
});

describe('BRIDGE_VERSION', () => {
  it('matches package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(BRIDGE_VERSION).toBe(pkg.version);
  });
});

describe('startBridge close', () => {
  it('closes everything even when one part rejects, then rethrows', async () => {
    const { root, cleanup } = await copyFixture();
    cleanups.push(cleanup);
    watchers.length = 0;
    const bridge = await startBridge({ root, port: 0, strictPort: true, engine: 'fake', allowedOrigins: [], webUrl: 'x' });
    const spy = (watchers[0] as unknown as { spy: ReturnType<typeof vi.spyOn> }).spy;
    spy.mockRejectedValueOnce(new Error('boom'));
    await expect(bridge.close()).rejects.toThrow('boom');
    await expect(fetch(`http://127.0.0.1:${bridge.port}`)).rejects.toThrow();
  });
});
