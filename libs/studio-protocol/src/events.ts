import { z } from 'zod';
import { AttachmentRef, PromptRefs } from './attachments';
import { AlwaysOffer, AlwaysRule, Author, ChannelId, Effort, MAX_QUESTIONS, Presence, Question, QuestionAnswer, SessionStatus, ThreadInfo } from './domain';
import { MAX_ATTACHMENTS } from './limits';
import { Area, WorkspaceSnapshot } from './snapshot';

export const Usage = z.object({
  model: z.string(),
  effort: Effort.nullable(),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
});
export type Usage = z.infer<typeof Usage>;

export const ThreadEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('user.message'),
    text: z.string(),
    attachments: z.array(AttachmentRef).max(MAX_ATTACHMENTS).optional(),
    refs: PromptRefs.optional(),
    pendingId: z.string().optional(),
    delivery: z.enum(['cut-point', 'next-turn']).optional(),
  }),
  z.object({
    type: z.literal('pending.added'),
    pendingId: z.string(),
    text: z.string(),
    attachments: z.array(AttachmentRef).max(MAX_ATTACHMENTS).optional(),
    refs: PromptRefs.optional(),
  }),
  z.object({ type: z.literal('pending.edited'), pendingId: z.string(), text: z.string() }),
  z.object({ type: z.literal('pending.removed'), pendingId: z.string() }),
  z.object({ type: z.literal('pending.reverted'), pendingId: z.string(), reason: z.literal('interrupt') }),
  z.object({ type: z.literal('message.start'), messageId: z.string(), author: Author }),
  z.object({ type: z.literal('message.delta'), messageId: z.string(), text: z.string() }),
  z.object({ type: z.literal('message.end'), messageId: z.string() }),
  z.object({
    type: z.literal('tool.start'),
    toolUseId: z.string(),
    author: Author,
    tool: z.string(),
    summary: z.string(),
    diff: z.string().optional(),
    summaryTruncated: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('document.touched'),
    path: z.string().min(1).max(1024),
    op: z.enum(['created', 'modified', 'deleted']),
    author: Author,
  }),
  z.object({ type: z.literal('tool.end'), toolUseId: z.string(), isError: z.boolean(), summary: z.string() }),
  z.object({ type: z.literal('subagent.start'), agentId: z.string(), agentType: z.string() }),
  z.object({ type: z.literal('subagent.stop'), agentId: z.string(), agentType: z.string() }),
  z.object({
    type: z.literal('approval.requested'),
    approvalId: z.string(),
    author: Author,
    tool: z.string(),
    summary: z.string(),
    diff: z.string().optional(),
    /** JSON.stringify of the full tool input, capped at 16 384 chars. */
    input: z.string().optional(),
    inputTruncated: z.boolean().optional(),
    gateWarning: z.string().optional(),
    always: AlwaysOffer.optional(),
  }),
  z.object({
    type: z.literal('approval.resolved'),
    approvalId: z.string(),
    decision: z.enum(['allow', 'deny']),
    reason: z.string().optional(),
    remembered: AlwaysRule.optional(),
  }),
  z.object({
    type: z.literal('question.requested'),
    questionId: z.string(),
    author: Author,
    questions: z.array(Question).min(1).max(MAX_QUESTIONS),
  }),
  z.object({
    type: z.literal('question.resolved'),
    questionId: z.string(),
    outcome: z.enum(['answered', 'declined', 'cancelled']),
    answers: z.array(QuestionAnswer).max(MAX_QUESTIONS).optional(),
  }),
  z.object({ type: z.literal('turn.end'), usage: Usage }),
  z.object({
    type: z.literal('session.status'),
    status: SessionStatus,
    error: z.object({ code: z.string(), message: z.string() }).optional(),
  }),
]);
export type ThreadEvent = z.infer<typeof ThreadEvent>;

export const BotKind = z.enum([
  'spec.created',
  'spec.status',
  'cycle.opened',
  'cycle.status',
  'task.status',
  'fix.created',
  'fix.status',
]);
export type BotKind = z.infer<typeof BotKind>;
export const BotEvent = z.object({ channelId: ChannelId, botKind: BotKind, payload: z.record(z.string(), z.unknown()) });
export type BotEvent = z.infer<typeof BotEvent>;

export const ServerEvent = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('thread.event'),
    threadId: z.string(),
    seq: z.number().int().nonnegative(),
    event: ThreadEvent,
  }),
  z.object({ kind: z.literal('thread.updated'), thread: ThreadInfo }),
  z.object({ kind: z.literal('presence.changed'), presence: z.array(Presence) }),
  z.object({ kind: z.literal('workspace.changed'), areas: z.array(Area), snapshot: WorkspaceSnapshot }),
  z.object({ kind: z.literal('bot.event'), ...BotEvent.shape }),
  z.object({
    kind: z.literal('command.output'),
    runId: z.string(),
    stream: z.enum(['stdout', 'stderr']),
    chunk: z.string(),
  }),
  z.object({ kind: z.literal('command.exit'), runId: z.string(), exitCode: z.number().int() }),
]);
export type ServerEvent = z.infer<typeof ServerEvent>;
