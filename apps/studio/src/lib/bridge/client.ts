import {
  decodeServerMessage,
  PROTOCOL_VERSION,
  type ClientCommand,
  type ServerEvent,
  type Welcome,
} from '@sdd-studio/protocol';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type CommandInput = DistributiveOmit<ClientCommand, 'kind' | 'id'>;

export type ConnectionState =
  | { status: 'idle' }
  | { status: 'connecting'; attempt: number }
  | { status: 'open'; welcome: Welcome }
  | { status: 'reconnecting'; attempt: number; delayMs: number }
  | { status: 'failed'; reason: 'bad-token' | 'protocol-mismatch' | 'unreachable'; message: string };

export class BridgeError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface Pending {
  resolve: (data: unknown) => void;
  reject: (error: BridgeError) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface BridgeClientOptions {
  url: string;
  token: string;
  clientVersion: string;
  WebSocketImpl?: typeof WebSocket;
  maxDelayMs?: number;
  requestTimeoutMs?: number;
  unreachableAfter?: number;
}

export class BridgeClient {
  state: ConnectionState = { status: 'idle' };
  private ws: WebSocket | null = null;
  private seq = 0;
  private failures = 0;
  private everOpened = false;
  private stopped = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastHandshakeMessage: string | null = null;
  private readonly pending = new Map<string, Pending>();
  private readonly eventListeners = new Set<(e: ServerEvent) => void>();
  private readonly stateListeners = new Set<(s: ConnectionState) => void>();

  constructor(private readonly o: BridgeClientOptions) {}

  connect(): void {
    this.stopped = false;
    this.open();
  }

  close(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const ws = this.ws;
    this.ws = null;
    ws?.close(1000);
    this.rejectAll('disconnected', 'conexión cerrada');
    this.setState({ status: 'idle' });
  }

  onEvent(fn: (e: ServerEvent) => void): () => void {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  onState(fn: (s: ConnectionState) => void): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  request(cmd: CommandInput): Promise<unknown> {
    const ws = this.ws;
    if (this.state.status !== 'open' || !ws) {
      return Promise.reject(new BridgeError('not-connected', 'sin conexión con el puente'));
    }
    const id = `c${++this.seq}`;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new BridgeError('timeout', `el puente no respondió a ${cmd.cmd}`));
      }, this.o.requestTimeoutMs ?? 15_000);
      this.pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ kind: 'command', id, ...cmd }));
    });
  }

  private open(): void {
    this.lastHandshakeMessage = null;
    if (!this.everOpened) this.setState({ status: 'connecting', attempt: this.failures + 1 });
    const Impl = this.o.WebSocketImpl ?? WebSocket;
    const ws = new Impl(this.o.url);
    this.ws = ws;
    ws.onopen = () => {
      ws.send(
        JSON.stringify({ kind: 'hello', token: this.o.token, protocolVersion: PROTOCOL_VERSION, clientVersion: this.o.clientVersion }),
      );
    };
    ws.onmessage = (event) => this.handle(String(event.data));
    ws.onclose = (event) => {
      if (this.ws === ws) this.onClose(event.code);
    };
    ws.onerror = () => undefined;
  }

  private handle(raw: string): void {
    const decoded = decodeServerMessage(raw);
    if (!decoded.ok) return;
    const message = decoded.value;
    switch (message.kind) {
      case 'welcome':
        this.everOpened = true;
        this.failures = 0;
        this.setState({ status: 'open', welcome: message });
        return;
      case 'handshake.error':
        this.lastHandshakeMessage = message.message;
        return;
      case 'result': {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.ok) pending.resolve(message.data);
        else pending.reject(new BridgeError(message.error.code, message.error.message));
        return;
      }
      default:
        for (const fn of this.eventListeners) fn(message);
    }
  }

  private onClose(code: number): void {
    this.ws = null;
    this.rejectAll('disconnected', 'se perdió la conexión con el puente');
    if (this.stopped) return;
    if (code === 4001) {
      this.stopped = true;
      return this.setState({ status: 'failed', reason: 'bad-token', message: this.lastHandshakeMessage ?? 'token inválido' });
    }
    if (code === 4002) {
      this.stopped = true;
      return this.setState({ status: 'failed', reason: 'protocol-mismatch', message: this.lastHandshakeMessage ?? 'versión de protocolo incompatible' });
    }
    this.failures += 1;
    if (!this.everOpened && this.failures >= (this.o.unreachableAfter ?? 3)) {
      this.stopped = true;
      return this.setState({ status: 'failed', reason: 'unreachable', message: 'no se pudo conectar al puente' });
    }
    const delayMs = Math.min(this.o.maxDelayMs ?? 30_000, 500 * 2 ** (this.failures - 1));
    this.setState({ status: 'reconnecting', attempt: this.failures, delayMs });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.stopped) this.open();
    }, delayMs);
  }

  private rejectAll(code: string, message: string): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new BridgeError(code, message));
      this.pending.delete(id);
    }
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    for (const fn of this.stateListeners) fn(state);
  }
}
