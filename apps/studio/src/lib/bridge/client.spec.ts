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
  static asyncClose = false;
  close(code = 1000) {
    this.readyState = 3;
    if (FakeSocket.asyncClose) queueMicrotask(() => this.onclose?.({ code }));
    else this.onclose?.({ code });
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
  FakeSocket.asyncClose = false;
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

  it('connect() is idempotent', () => {
    const { client, socket } = make();
    const events: unknown[] = [];
    client.onEvent((e) => events.push(e));
    client.connect();
    client.connect();
    expect(FakeSocket.instances).toHaveLength(1);
    socket().open();
    socket().receive(welcome);
    client.connect();
    socket().receive({ kind: 'command.exit', runId: 'r', exitCode: 0 });
    expect(FakeSocket.instances).toHaveLength(1);
    expect(events).toHaveLength(1);
  });

  it('connect() while reconnecting does not create an extra socket', () => {
    const { client, socket } = make();
    client.connect();
    socket().drop(1006);
    client.connect();
    vi.advanceTimersByTime(500);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('ignores a welcome arriving on an orphaned socket after close()', () => {
    const { client, socket } = make();
    client.connect();
    const old = socket();
    client.close();
    old.open();
    old.receive(welcome);
    expect(client.state).toEqual({ status: 'idle' });
    expect(old.sent).toHaveLength(0);
  });

  it('close() while reconnecting never opens a socket', () => {
    const { client, socket } = make();
    client.connect();
    socket().open();
    socket().receive(welcome);
    socket().drop(1006);
    client.close();
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(client.state).toEqual({ status: 'idle' });
  });

  it('caps the backoff at maxDelayMs and resets after a welcome', () => {
    const { client, states, socket } = make({ maxDelayMs: 2000 });
    client.connect();
    socket().open();
    socket().receive(welcome);
    const delays: number[] = [];
    for (let i = 0; i < 5; i++) {
      socket().drop(1006);
      const s = states.at(-1) as { delayMs: number };
      delays.push(s.delayMs);
      vi.advanceTimersByTime(s.delayMs);
    }
    expect(delays).toEqual([500, 1000, 2000, 2000, 2000]);
    socket().open();
    socket().receive(welcome);
    socket().drop(1006);
    expect(states.at(-1)).toEqual({ status: 'reconnecting', attempt: 1, delayMs: 500 });
  });

  it('close() rejects in-flight requests with disconnected', async () => {
    const { client, socket } = make();
    client.connect();
    socket().open();
    socket().receive(welcome);
    const p = client.request({ cmd: 'thread.list' });
    client.close();
    await expect(p).rejects.toMatchObject({ code: 'disconnected' });
  });

  it('guards hold with an asynchronous close', () => {
    const { client, socket } = make();
    client.connect();
    socket().open();
    socket().receive(welcome);
    FakeSocket.asyncClose = true;
    client.close();
    client.connect();
    const second = socket();
    expect(FakeSocket.instances).toHaveLength(2);
    second.open();
    second.receive(welcome);
    return Promise.resolve().then(() => {
      expect(client.state.status).toBe('open');
      expect(FakeSocket.instances).toHaveLength(2);
    });
  });

  it('ignores the late result of a timed-out request', async () => {
    const { client, socket } = make({ requestTimeoutMs: 1000 });
    client.connect();
    socket().open();
    socket().receive(welcome);
    const p = client.request({ cmd: 'thread.list' });
    const id = JSON.parse(socket().sent[1]!).id;
    vi.advanceTimersByTime(1001);
    await expect(p).rejects.toMatchObject({ code: 'timeout' });
    expect(() => socket().receive({ kind: 'result', id, ok: true, data: [] })).not.toThrow();
  });

  it('fails terminally when the socket opens but no welcome arrives within 10 s', () => {
    const { client, states, socket } = make();
    client.connect();
    socket().open();
    vi.advanceTimersByTime(9_999);
    expect(states.at(-1)).toMatchObject({ status: 'connecting' });
    vi.advanceTimersByTime(2);
    expect(states.at(-1)).toEqual({ status: 'failed', reason: 'bad-message', message: 'el puente no completó el handshake' });
    expect(socket().readyState).toBe(3);
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });
  it('clears the handshake timer once welcome arrives', () => {
    const { client, states, socket } = make();
    client.connect();
    socket().open();
    socket().receive(welcome);
    vi.advanceTimersByTime(30_000);
    expect(states.at(-1)).toMatchObject({ status: 'open' });
  });

  it('fails terminally on close 4000 bad-message, retries on timeout', () => {
    const a = make();
    a.client.connect();
    a.socket().open();
    a.socket().receive({ kind: 'handshake.error', code: 'bad-message', message: 'raro' });
    a.socket().drop(4000);
    expect(a.states.at(-1)).toEqual({ status: 'failed', reason: 'bad-message', message: 'raro' });
    const b = make();
    b.client.connect();
    b.socket().open();
    b.socket().receive({ kind: 'handshake.error', code: 'timeout', message: 'lento' });
    b.socket().drop(4000);
    expect(b.states.at(-1)).toMatchObject({ status: 'reconnecting' });
  });

  it('connect() after a terminal failure restarts the attempts', () => {
    const { client, states, socket } = make({ unreachableAfter: 2 });
    client.connect();
    socket().drop(1006);
    vi.advanceTimersByTime(500);
    socket().drop(1006);
    expect(client.state).toMatchObject({ status: 'failed', reason: 'unreachable' });
    client.connect();
    expect(states.at(-1)).toEqual({ status: 'connecting', attempt: 1 });
    socket().drop(1006);
    expect(client.state.status).toBe('reconnecting');
    vi.advanceTimersByTime(500);
    socket().drop(1006);
    expect(client.state).toMatchObject({ status: 'failed', reason: 'unreachable' });
  });

  it('isolates throwing listeners', () => {
    const { client, socket } = make();
    const seen: string[] = [];
    client.onState(() => {
      throw new Error('boom');
    });
    client.onState((s) => seen.push(s.status));
    client.connect();
    socket().drop(1006);
    vi.advanceTimersByTime(500);
    expect(FakeSocket.instances).toHaveLength(2);
    expect(seen).toContain('reconnecting');
  });
});
