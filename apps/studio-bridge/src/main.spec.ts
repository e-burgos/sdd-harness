import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PROTOCOL_VERSION, defaultThreadOptions, type ServerMessage } from '@sdd-studio/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { detectAuthMode } from './auth-mode';
import { BridgeStartError, DEFAULT_ORIGINS, startBridge } from './main';
import { copyFixture, waitFor } from './test-utils/fixture';
import { BRIDGE_VERSION } from './version';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

describe('startBridge', () => {
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
