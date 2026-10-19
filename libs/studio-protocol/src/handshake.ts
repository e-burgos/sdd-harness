import { z } from 'zod';
import { AuthMode } from './domain';

export const Hello = z.object({
  kind: z.literal('hello'),
  token: z.string().min(1).max(256),
  protocolVersion: z.number().int(),
  clientVersion: z.string().max(64),
});
export type Hello = z.infer<typeof Hello>;

export const Welcome = z.object({
  kind: z.literal('welcome'),
  protocolVersion: z.number().int(),
  bridgeVersion: z.string(),
  workspace: z.object({ root: z.string(), project: z.string() }),
  kitVersion: z.string().nullable(),
  authMode: AuthMode,
});
export type Welcome = z.infer<typeof Welcome>;

export const HandshakeErrorCode = z.enum(['bad-token', 'protocol-mismatch', 'bad-message', 'timeout']);
export type HandshakeErrorCode = z.infer<typeof HandshakeErrorCode>;
export const HandshakeError = z.object({
  kind: z.literal('handshake.error'),
  code: HandshakeErrorCode,
  message: z.string(),
});
export type HandshakeError = z.infer<typeof HandshakeError>;
