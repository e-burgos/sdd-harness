import { PROTOCOL_VERSION } from '@sdd-studio/protocol';
import { BridgeClient, type ConnectionState } from './client';

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;
  sent: string[] = [];
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(code = 1000) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  // helpers
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  drop(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const welcome = {
  kind: 'welcome', protocolVersion: PROTOCOL_VERSION, bridgeVersion: '0.1.0',
  workspace: { root: '/r', project: 'p' }, kitVersion: null, authMode: 'local-claude-login',
};

function make(extra: Partial<ConstructorParameters<typeof BridgeClient>[0]> = {}) {
  FakeSocket.instances = [];
  const states: ConnectionState[] = [];
  const client = new BridgeClient({
    url: 'ws://127.0.0.1:1', token: 'tok', clientVersion: 'test',
    WebSocketImpl: FakeSocket as unknown as typeof WebSocket, ...extra,
  });
  client.onState((s) => states.push(s));
  return { client, states, socket: () => FakeSocket.instances.at(-1)! };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('BridgeClient', () => {
  it('sends hello on open and becomes open on welcome', () => {
    const { client, states, socket } = make();
    client.connect();
    socket().open();
    expect(JSON.parse(socket().sent[0]!)).toEqual({ kind: 'hello', token: 'tok', protocolVersion: PROTOCOL_VERSION, clientVersion: 'test' });
    socket().receive(welcome);
    expect(states.map((s) => s.status)).toEqual(['connecting', 'open']);
  });

  it('correlates command results by id', async () => {
    const { client, socket } = make();
    client.connect();
    socket().open();
    socket().receive(welcome);
    const p = client.request({ cmd: 'thread.list' });
    const sent = JSON.parse(socket().sent[1]!);
    expect(sent).toMatchObject({ kind: 'command', cmd: 'thread.list' });
    socket().receive({ kind: 'result', id: sent.id, ok: true, data: [] });
    await expect(p).resolves.toEqual([]);
  });

  it('rejects failed results with a BridgeError carrying the code', async () => {
    const { client, socket } = make();
    client.connect();
    socket().open();
    socket().receive(welcome);
    const p = client.request({ cmd: 'workspace.readFile', path: 'sdd/x' });
    const id = JSON.parse(socket().sent[1]!).id;
    socket().receive({ kind: 'result', id, ok: false, error: { code: 'bad-path', message: 'no' } });
    await expect(p).rejects.toMatchObject({ code: 'bad-path' });
  });

  it('rejects requests when not connected and on timeout', async () => {
    const { client, socket } = make({ requestTimeoutMs: 1000 });
    await expect(client.request({ cmd: 'thread.list' })).rejects.toMatchObject({ code: 'not-connected' });
    client.connect();
    socket().open();
    socket().receive(welcome);
    const p = client.request({ cmd: 'thread.list' });
    vi.advanceTimersByTime(1001);
    await expect(p).rejects.toMatchObject({ code: 'timeout' });
  });

  it('forwards valid push events and drops invalid messages', () => {
    const { client, socket } = make();
    const events: unknown[] = [];
    client.onEvent((e) => events.push(e));
    client.connect();
    socket().open();
    socket().receive(welcome);
    socket().receive({ kind: 'command.exit', runId: 'r', exitCode: 0 });
    socket().receive({ kind: 'nope' });
    socket().onmessage?.({ data: '{broken' });
    expect(events).toEqual([{ kind: 'command.exit', runId: 'r', exitCode: 0 }]);
  });

  it('reconnects with exponential backoff after a drop and rejects in-flight requests', async () => {
    const { client, states, socket } = make({ maxDelayMs: 4000 });
    client.connect();
    socket().open();
    socket().receive(welcome);
    const p = client.request({ cmd: 'thread.list' });
    socket().drop(1006);
    await expect(p).rejects.toMatchObject({ code: 'disconnected' });
    expect(states.at(-1)).toEqual({ status: 'reconnecting', attempt: 1, delayMs: 500 });
    vi.advanceTimersByTime(500);
    expect(FakeSocket.instances).toHaveLength(2);
    socket().drop(1006);
    expect(states.at(-1)).toEqual({ status: 'reconnecting', attempt: 2, delayMs: 1000 });
  });

  it('stops on bad token and on protocol mismatch', () => {
    const a = make();
    a.client.connect();
    a.socket().open();
    a.socket().receive({ kind: 'handshake.error', code: 'bad-token', message: 'token inválido' });
    a.socket().drop(4001);
    expect(a.states.at(-1)).toEqual({ status: 'failed', reason: 'bad-token', message: 'token inválido' });
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);

    const b = make();
    b.client.connect();
    b.socket().open();
    b.socket().drop(4002);
    expect(b.states.at(-1)).toMatchObject({ status: 'failed', reason: 'protocol-mismatch' });
  });

  it('gives up as unreachable when it never opened after N attempts', () => {
    const { client, states, socket } = make({ unreachableAfter: 2 });
    client.connect();
    socket().drop(1006);
    vi.advanceTimersByTime(500);
    socket().drop(1006);
    expect(states.at(-1)).toMatchObject({ status: 'failed', reason: 'unreachable' });
  });

  it('close() stops reconnecting', () => {
    const { client, socket } = make();
    client.connect();
    socket().open();
    socket().receive(welcome);
    client.close();
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(client.state).toEqual({ status: 'idle' });
  });
});
