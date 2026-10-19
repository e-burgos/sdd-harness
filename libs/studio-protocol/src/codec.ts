import { z } from 'zod';
import { ClientCommand, CommandResult } from './commands';
import { ServerEvent } from './events';
import { HandshakeError, Hello, Welcome } from './handshake';

export const ClientMessage = z.union([Hello, ClientCommand]);
export type ClientMessage = z.infer<typeof ClientMessage>;
export const ServerMessage = z.union([Welcome, HandshakeError, CommandResult, ServerEvent]);
export type ServerMessage = z.infer<typeof ServerMessage>;

export type Decoded<T> = { ok: true; value: T } | { ok: false; error: string };

function decode<T>(schema: z.ZodType<T>, raw: string): Decoded<T> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  const result = schema.safeParse(json);
  if (result.success) return { ok: true, value: result.data };
  const error = result.error.issues.map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`).join('; ');
  return { ok: false, error: error.slice(0, 500) };
}

export const decodeClientMessage = (raw: string): Decoded<ClientMessage> => decode(ClientMessage, raw);
export const decodeServerMessage = (raw: string): Decoded<ServerMessage> => decode(ServerMessage, raw);
export const encodeMessage = (message: ClientMessage | ServerMessage): string => JSON.stringify(message);
