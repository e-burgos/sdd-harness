import { z } from 'zod';
import { AttachmentMime, AttachmentUpload, PromptRefs, Sha256 } from './attachments';
import { AuthPreference, ChannelId, DevProfile, MAX_QUESTIONS, QuestionAnswer, ThreadLinkRef, ThreadLinkTarget, ThreadOptions } from './domain';
import { FILE_SEARCH_MAX, MAX_ATTACHMENTS } from './limits';

const Id = z.string().min(1).max(64);
const Text = z.string().max(100_000);
const SafeArg = z.string().regex(/^[A-Za-z0-9._-]{1,80}$/);
const cmd = <T extends string>(name: T) => ({ kind: z.literal('command'), id: Id, cmd: z.literal(name) });

const MessageBody = {
  text: Text,
  attachments: z.array(AttachmentUpload).max(MAX_ATTACHMENTS).default([]),
  refs: PromptRefs.default({ agents: [], skills: [] }),
};
const hasContent = (message: { text: string; attachments: unknown[] }) =>
  message.text.trim().length > 0 || message.attachments.length > 0;
const contentRequired = { message: 'text or attachments required', path: ['text'] };

export const KitCommandName = z.enum(['gate', 'validate', 'rebuild-tasks-index', 'rebuild-catalog']);
export type KitCommandName = z.infer<typeof KitCommandName>;

export const ClientCommand = z.discriminatedUnion('cmd', [
  z.object({ ...cmd('workspace.snapshot') }),
  z.object({ ...cmd('presence.get') }),
  z.object({ ...cmd('workspace.readFile'), path: z.string().min(1).max(512) }),
  z
    .object({ ...cmd('thread.create'), channelId: ChannelId, options: ThreadOptions, link: ThreadLinkTarget.optional(), ...MessageBody })
    .refine(hasContent, contentRequired),
  z.object({ ...cmd('thread.send'), threadId: Id, ...MessageBody }).refine(hasContent, contentRequired),
  z.object({ ...cmd('thread.pending.edit'), threadId: Id, pendingId: Id, text: Text }),
  z.object({ ...cmd('thread.pending.remove'), threadId: Id, pendingId: Id }),
  z.object({ ...cmd('thread.pending.flush'), threadId: Id }),
  z.object({ ...cmd('thread.setLink'), threadId: Id, link: ThreadLinkTarget }),
  z.object({
    ...cmd('thread.updateLinks'),
    threadId: Id,
    add: z.array(ThreadLinkRef).max(8).default([]),
    remove: z.array(ThreadLinkRef).max(8).default([]),
  }),
  z.object({
    ...cmd('workspace.searchFiles'),
    query: z.string().max(200),
    limit: z.number().int().min(1).max(FILE_SEARCH_MAX).default(30),
  }),
  z.object({ ...cmd('attachment.get'), sha256: Sha256, mime: AttachmentMime }),
  z.object({ ...cmd('thread.interrupt'), threadId: Id }),
  z.object({ ...cmd('thread.setOptions'), threadId: Id, options: ThreadOptions.omit({ agent: true }).partial() }),
  z.object({ ...cmd('thread.list'), channelId: ChannelId.optional() }),
  z.object({
    ...cmd('thread.history'),
    threadId: Id,
    sinceSeq: z.number().int().nonnegative(),
    includeDocumentTouched: z.boolean().default(false),
    includeQuestions: z.boolean().default(false),
  }),
  z.object({ ...cmd('channel.botHistory'), channelId: ChannelId, limit: z.number().int().min(1).max(200) }),
  z.object({
    ...cmd('approval.respond'),
    approvalId: Id,
    decision: z.enum(['allow', 'deny']),
    reason: z.string().max(2000).optional(),
    scope: z.enum(['once', 'thread']),
  }),
  z.object({
    ...cmd('question.answer'),
    questionId: Id,
    answers: z.array(QuestionAnswer).max(MAX_QUESTIONS).default([]),
    decline: z.boolean().default(false),
  }),
  z.object({ ...cmd('profile.set'), profile: DevProfile }),
  z.object({ ...cmd('command.run'), name: KitCommandName, args: z.array(SafeArg).max(4) }),
  // Held in bridge memory only (never persisted or logged). null = back to ANTHROPIC_API_KEY / local login.
  z.object({ ...cmd('auth.set'), apiKey: z.string().regex(/^\S{20,512}$/).nullable(), mode: AuthPreference.optional() }),
  z.object({ ...cmd('auth.status') }),
  z.object({ ...cmd('auth.login') }),
  z.object({ ...cmd('auth.logout') }),
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

export const SendResult = z.discriminatedUnion('delivery', [
  z.object({ delivery: z.literal('started') }),
  z.object({ delivery: z.literal('pending'), pendingId: z.string().min(1) }),
]);
export type SendResult = z.infer<typeof SendResult>;

export const FileSearchResult = z.object({
  query: z.string(),
  files: z.array(z.object({ path: z.string().min(1).max(1024) })).max(FILE_SEARCH_MAX),
  truncated: z.boolean(),
  source: z.enum(['git', 'walk']),
});
export type FileSearchResult = z.infer<typeof FileSearchResult>;
