import { z } from 'zod';
import { ChannelId, ThreadOptions } from './domain';

const Id = z.string().min(1).max(64);
const Text = z.string().min(1).max(100_000);
const SafeArg = z.string().regex(/^[A-Za-z0-9._-]{1,80}$/);
const cmd = <T extends string>(name: T) => ({ kind: z.literal('command'), id: Id, cmd: z.literal(name) });

export const KitCommandName = z.enum(['gate', 'validate', 'rebuild-tasks-index', 'rebuild-catalog']);
export type KitCommandName = z.infer<typeof KitCommandName>;

export const ClientCommand = z.discriminatedUnion('cmd', [
  z.object({ ...cmd('workspace.snapshot') }),
  z.object({ ...cmd('presence.get') }),
  z.object({ ...cmd('workspace.readFile'), path: z.string().min(1).max(512) }),
  z.object({ ...cmd('thread.create'), channelId: ChannelId, options: ThreadOptions, text: Text }),
  z.object({ ...cmd('thread.send'), threadId: Id, text: Text }),
  z.object({ ...cmd('thread.interrupt'), threadId: Id }),
  z.object({ ...cmd('thread.setOptions'), threadId: Id, options: ThreadOptions.omit({ agent: true }).partial() }),
  z.object({ ...cmd('thread.list'), channelId: ChannelId.optional() }),
  z.object({ ...cmd('thread.history'), threadId: Id, sinceSeq: z.number().int().nonnegative() }),
  z.object({ ...cmd('channel.botHistory'), channelId: ChannelId, limit: z.number().int().min(1).max(200) }),
  z.object({
    ...cmd('approval.respond'),
    approvalId: Id,
    decision: z.enum(['allow', 'deny']),
    reason: z.string().max(2000).optional(),
    scope: z.enum(['once', 'thread']),
  }),
  z.object({ ...cmd('command.run'), name: KitCommandName, args: z.array(SafeArg).max(4) }),
]);
export type ClientCommand = z.infer<typeof ClientCommand>;

export const ErrorCode = z.enum(['bad-request', 'not-found', 'bad-path', 'conflict', 'internal']);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const CommandResult = z.union([
  z.object({ kind: z.literal('result'), id: z.string(), ok: z.literal(true), data: z.unknown() }),
  z.object({
    kind: z.literal('result'),
    id: z.string(),
    ok: z.literal(false),
    error: z.object({ code: ErrorCode, message: z.string() }),
  }),
]);
export type CommandResult = z.infer<typeof CommandResult>;
