import { createServer, type Server } from 'node:http';
import {
  decodeClientMessage,
  PROTOCOL_VERSION,
  type ClientCommand,
  type ErrorCode,
  type ServerMessage,
  type Welcome,
} from '@sdd-studio/protocol';
import { WebSocketServer, type WebSocket } from 'ws';
import { SessionError } from '../sessions/session-manager';
import { PathError } from '../workspace/paths';
import { originAllowed, tokensMatch } from './security';

export const MAX_PAYLOAD_BYTES = 1_048_576;

export interface BridgeHandlers {
  welcome(): Omit<Welcome, 'kind' | 'protocolVersion'>;
  handle(command: ClientCommand): Promise<unknown>;
}

export interface BridgeServer {
  port: number;
  broadcast(message: ServerMessage): void;
  close(): Promise<void>;
}

function toError(error: unknown): { code: ErrorCode; message: string } {
  if (error instanceof SessionError || error instanceof PathError) return { code: error.code, message: error.message };
  return { code: 'internal', message: error instanceof Error ? error.message : String(error) };
}

async function listen(http: Server, port: number, strictPort: boolean): Promise<number> {
  for (let attempt = 0; attempt < (strictPort ? 1 : 10); attempt++) {
    const candidate = port === 0 ? 0 : port + attempt;
    try {
      await new Promise<void>((resolve, reject) => {
        http.once('error', reject);
        http.listen(candidate, '127.0.0.1', () => (http.off('error', reject), resolve()));
      });
      const address = http.address();
      return typeof address === 'object' && address ? address.port : candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || strictPort) throw error;
    }
  }
  throw new Error(`no hay puertos libres desde ${port}`);
}

export async function startBridgeServer(o: {
  port: number;
  strictPort: boolean;
  token: string;
  allowedOrigins: string[];
  handlers: BridgeHandlers;
  helloTimeoutMs?: number;
}): Promise<BridgeServer> {
  const http = createServer((_req, res) => {
    res.writeHead(426, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('SDD Studio bridge: conectate por WebSocket.');
  });
  const wss = new WebSocketServer({
    server: http,
    maxPayload: MAX_PAYLOAD_BYTES,
    verifyClient: (info, done) => done(originAllowed(info.origin || undefined, o.allowedOrigins), 403),
  });
  const clients = new Set<WebSocket>();
  const send = (ws: WebSocket, message: ServerMessage) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  };

  wss.on('connection', (ws) => {
    let authed = false;
    const reject = (code: 'bad-message' | 'bad-token' | 'protocol-mismatch' | 'timeout', message: string, closeCode: number) => {
      send(ws, { kind: 'handshake.error', code, message });
      ws.close(closeCode);
    };
    const timer = setTimeout(() => reject('timeout', 'no llegó el hello a tiempo', 4000), o.helloTimeoutMs ?? 5000);

    ws.on('message', async (raw) => {
      const decoded = decodeClientMessage(raw.toString());
      if (!authed) {
        clearTimeout(timer);
        if (!decoded.ok || decoded.value.kind !== 'hello') return reject('bad-message', 'se esperaba hello', 4000);
        if (!tokensMatch(decoded.value.token, o.token)) return reject('bad-token', 'token inválido', 4001);
        if (decoded.value.protocolVersion !== PROTOCOL_VERSION) {
          return reject('protocol-mismatch', `el puente habla el protocolo ${PROTOCOL_VERSION}`, 4002);
        }
        authed = true;
        clients.add(ws);
        send(ws, { kind: 'welcome', protocolVersion: PROTOCOL_VERSION, ...o.handlers.welcome() });
        return undefined;
      }
      if (!decoded.ok) {
        send(ws, { kind: 'result', id: 'unknown', ok: false, error: { code: 'bad-request', message: decoded.error } });
        return undefined;
      }
      if (decoded.value.kind === 'hello') return undefined;
      const command = decoded.value;
      try {
        const data = await o.handlers.handle(command);
        send(ws, { kind: 'result', id: command.id, ok: true, data: data ?? null });
      } catch (error) {
        send(ws, { kind: 'result', id: command.id, ok: false, error: toError(error) });
      }
      return undefined;
    });
    // ws emite 'error' (p. ej. frame > maxPayload) antes de cerrar con 1009; sin listener sería una excepción no capturada que tumba el puente.
    ws.on('error', () => {}); // ws cierra solo (1009) tras emitirlo
    ws.on('close', () => {
      clearTimeout(timer);
      clients.delete(ws);
    });
  });

  const port = await listen(http, o.port, o.strictPort);
  return {
    port,
    broadcast: (message) => {
      const payload = JSON.stringify(message);
      for (const ws of clients) if (ws.readyState === ws.OPEN) ws.send(payload);
    },
    close: async () => {
      for (const ws of wss.clients) ws.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}
