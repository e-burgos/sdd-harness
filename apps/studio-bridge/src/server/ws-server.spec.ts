import { PROTOCOL_VERSION, type ServerMessage } from '@sdd-studio/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { waitFor } from '../test-utils/fixture';
import { MAX_PAYLOAD_BYTES, startBridgeServer, type BridgeServer } from './ws-server';

let server: BridgeServer | undefined;
afterEach(async () => server?.close());

const TOKEN = 'tok';
async function start(helloTimeoutMs = 2000) {
  server = await startBridgeServer({
    port: 0, strictPort: true, token: TOKEN, allowedOrigins: ['http://localhost:*'], helloTimeoutMs,
    handlers: {
      welcome: () => ({ bridgeVersion: '0.1.0', workspace: { root: '/r', project: 'p' }, kitVersion: null, authMode: 'local-claude-login' }),
      handle: async (cmd) => {
        if (cmd.cmd === 'thread.list') return [];
        throw new Error('boom');
      },
    },
  });
  return server;
}
function connect(s: BridgeServer, origin?: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${s.port}`, origin ? { origin } : {});
  const inbox: ServerMessage[] = [];
  let closeCode: number | null = null;
  ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
  ws.on('close', (code) => (closeCode = code));
  return { ws, inbox, closed: () => closeCode };
}
const opened = (ws: WebSocket) => new Promise<void>((res, rej) => (ws.once('open', () => res()), ws.once('error', rej)));
const hello = (token = TOKEN, protocolVersion = PROTOCOL_VERSION) =>
  JSON.stringify({ kind: 'hello', token, protocolVersion, clientVersion: 'test' });

describe('startBridgeServer', () => {
  it('listens on loopback only', async () => {
    const s = await start();
    expect(s.port).toBeGreaterThan(0);
  });

  it('rejects a foreign origin before the handshake', async () => {
    const s = await start();
    const c = connect(s, 'https://evil.example');
    await expect(opened(c.ws)).rejects.toThrow(/403/);
  });

  it('welcomes a valid hello and answers commands', async () => {
    const s = await start();
    const c = connect(s, 'http://localhost:5173');
    await opened(c.ws);
    c.ws.send(hello());
    await waitFor(() => c.inbox.find((m) => m.kind === 'welcome'));
    c.ws.send(JSON.stringify({ kind: 'command', id: 'a', cmd: 'thread.list' }));
    c.ws.send(JSON.stringify({ kind: 'command', id: 'b', cmd: 'workspace.snapshot' }));
    c.ws.send('{not json');
    await waitFor(() => c.inbox.filter((m) => m.kind === 'result').length === 3);
    expect(c.inbox).toContainEqual({ kind: 'result', id: 'a', ok: true, data: [] });
    expect(c.inbox).toContainEqual({ kind: 'result', id: 'b', ok: false, error: { code: 'internal', message: 'boom' } });
    expect(c.inbox).toContainEqual(expect.objectContaining({ kind: 'result', id: 'unknown', ok: false }));
  });

  it.each([
    ['bad token', hello('nope'), 4001],
    ['protocol mismatch', hello(TOKEN, 999), 4002],
    ['command before hello', JSON.stringify({ kind: 'command', id: 'a', cmd: 'thread.list' }), 4000],
  ])('closes on %s', async (_label, first, code) => {
    const s = await start();
    const c = connect(s);
    await opened(c.ws);
    c.ws.send(first);
    await waitFor(() => c.closed());
    expect(c.closed()).toBe(code);
    expect(c.inbox[0]?.kind).toBe('handshake.error');
  });

  it('closes when no hello arrives in time', async () => {
    const s = await start(100);
    const c = connect(s);
    await opened(c.ws);
    await waitFor(() => c.closed());
    expect(c.closed()).toBe(4000);
  });

  it('broadcasts only to authenticated clients (two tabs)', async () => {
    const s = await start();
    const a = connect(s);
    const b = connect(s);
    const anon = connect(s);
    await Promise.all([opened(a.ws), opened(b.ws), opened(anon.ws)]);
    a.ws.send(hello());
    b.ws.send(hello());
    await waitFor(() => a.inbox.length && b.inbox.length);
    s.broadcast({ kind: 'command.exit', runId: 'r', exitCode: 0 });
    await waitFor(() => a.inbox.length === 2 && b.inbox.length === 2);
    expect(anon.inbox).toEqual([]);
  });

  it('drops oversized messages', async () => {
    const s = await start();
    const c = connect(s);
    await opened(c.ws);
    c.ws.send(hello());
    await waitFor(() => c.inbox.length);
    c.ws.send('x'.repeat(MAX_PAYLOAD_BYTES + 1));
    await waitFor(() => c.closed());
    expect(c.closed()).toBe(1009);
  });
});
