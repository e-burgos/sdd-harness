import { randomUUID } from 'node:crypto';
import { dmAgentOfChannel, MAX_PENDING_PER_THREAD } from '@sdd-studio/protocol';
import type {
  AlwaysOffer,
  AlwaysRule,
  AttachmentRef,
  AttachmentUpload,
  Presence,
  PromptRefs,
  SendResult,
  ServerEvent,
  SessionStatus,
  ThreadEvent,
  ThreadInfo,
  ThreadLinkTarget,
  ThreadOptions,
  WorkspaceSnapshot,
} from '@sdd-studio/protocol';
import { createStablePrefixLoader } from '../engine/stable-prefix';
import { buildTurnPrompt, type AcceptedMessage } from '../engine/prompt-content';
import { diffFor, summarizeTool } from '../engine/tool-summary';
import {
  type AgentEngine,
  type ApprovalDecision,
  type ApprovalRequest,
  type EngineTurn,
  type JudgeContext,
  type OutgoingMessage,
  type ToolVerdict,
} from '../engine/types';
import { editTargetOf, judgeEdit } from '../gate/judge';
import { alwaysOfferOf, matchesRule, ruleOf } from './always-rule';
import type { AttachmentStore } from './attachment-store';
import { assignLink, linkTargetExists } from './thread-link';
import { PresenceTracker } from './presence';
import { toThreadInfo as toInfo, type HistoryEntry, type PendingMessage, type StoredThread, type ThreadStore } from './store';

export class SessionError extends Error {
  constructor(
    readonly code: 'not-found' | 'conflict' | 'bad-request',
    message: string,
  ) {
    super(message);
  }
}

export interface MessageInput {
  text: string;
  attachments?: AttachmentUpload[];
  refs?: PromptRefs;
}

export interface SessionManagerDeps {
  root: string;
  attachments: Pick<AttachmentStore, 'put' | 'read'>;
  engine: AgentEngine;
  store: ThreadStore;
  stablePrefix?: () => string;
  snapshot: () => WorkspaceSnapshot;
  broadcast: (message: ServerEvent) => void;
  newId?: () => string;
  now?: () => string;
  /**
   * Forces a fresh workspace snapshot. Used once by requestApproval before a gate deny is final.
   * The synchronous PreToolUse path (judgeTool) cannot await it and relies on the debounced watcher snapshot.
   */
  refreshSnapshot?: () => Promise<void>;
}

const INPUT_CAP = 16_384;

function serializeInput(input: Record<string, unknown>): { input: string; inputTruncated?: true } {
  let text: string;
  try {
    text = JSON.stringify(input) ?? '{}';
  } catch {
    text = '"[input no serializable]"';
  }
  return text.length > INPUT_CAP ? { input: text.slice(0, INPUT_CAP), inputTruncated: true } : { input: text };
}

interface Live {
  turn: EngineTurn | null;
  queued: OutgoingMessage[] | null;
  delivered: Map<string, PendingMessage>;
  deliveredIds: Set<string>;
  /** Monotonic FIFO order of the channel queue. */
  queuedAt: number;
  alwaysAllow: AlwaysRule[];
  /** toolUseId → reason of denies already announced by the PreToolUse hook (avoids duplicating the pair). */
  hookDenied: Map<string, string>;
  /** Raised in interrupt(), lowered when a new turn starts. */
  interrupted: boolean;
  /** Turn generation: invalidates late callbacks from a previous turn. */
  gen: number;
  /** Write mode frozen when queued/started; setOptions only affects the next turn. */
  writes: boolean;
  /** FIFO of acceptance decisions: a slow upload never lets a later message overtake an earlier one. */
  acceptTail: Promise<void>;
}

interface PendingApproval {
  threadId: string;
  always: AlwaysOffer;
  settle: (decision: ApprovalDecision, remembered?: AlwaysRule) => void;
}

/** All dm:* channels share a single write scope; the rest use their own channel. */
const writeScopeOf = (channelId: string): string => (channelId.startsWith('dm:') ? 'dm' : channelId);

const reportError = (error: unknown): void => console.error('[sdd-studio] session manager:', error);

const titleOf = ({ text, attachments }: AcceptedMessage): string =>
  ((text.split('\n')[0] ?? '').trim() || attachments[0]?.name || '').slice(0, 80);

const extrasOf = ({ attachments, refs }: AcceptedMessage) => ({
  ...(attachments.length > 0 ? { attachments } : {}),
  ...(refs.agents.length > 0 || refs.skills.length > 0 ? { refs } : {}),
});

export class SessionManager {
  private readonly live = new Map<string, Live>();
  private readonly approvals = new Map<string, PendingApproval>();
  private readonly tracker: PresenceTracker;
  private readonly newId: () => string;
  private readonly now: () => string;
  private readonly stablePrefix: () => string;
  private lastPresence = '';
  private queueCounter = 0;

  constructor(private readonly deps: SessionManagerDeps) {
    this.newId = deps.newId ?? randomUUID;
    this.now = deps.now ?? (() => new Date().toISOString());
    this.stablePrefix = deps.stablePrefix ?? createStablePrefixLoader(deps.root);
    this.tracker = new PresenceTracker(() => deps.snapshot().agents.map((a) => a.id));
    for (const thread of deps.store.list()) this.tracker.onThread(toInfo(thread));
  }

  list(channelId?: string): ThreadInfo[] {
    return this.deps.store.list(channelId).map(toInfo);
  }

  async history(threadId: string, sinceSeq: number): Promise<HistoryEntry[]> {
    this.require(threadId);
    return this.deps.store.history(threadId, sinceSeq);
  }

  presence(): Presence[] {
    return this.tracker.compute();
  }

  async createThread(args: { channelId: string; options: ThreadOptions; link?: ThreadLinkTarget } & MessageInput): Promise<ThreadInfo> {
    const dmAgent = dmAgentOfChannel(args.channelId);
    if (dmAgent !== null && args.options.agent !== dmAgent) {
      throw new SessionError('bad-request', `a DM with ${dmAgent} only accepts that agent`);
    }
    const link = assignLink({ channelId: args.channelId, snapshot: this.deps.snapshot(), explicit: args.link });
    if (!link) throw new SessionError('not-found', 'the link target does not exist');
    const accepted = await this.accept(args);
    const now = this.now();
    const thread: StoredThread = {
      id: this.newId(),
      channelId: args.channelId,
      title: titleOf(accepted),
      agent: args.options.agent,
      options: args.options,
      status: 'idle',
      createdAt: now,
      lastActivity: now,
      engineSessionId: null,
      provider: this.deps.engine.provider,
      link,
      pending: [],
    };
    this.persist(thread);
    this.tracker.onThread(toInfo(thread));
    this.deps.broadcast({ kind: 'thread.updated', thread: toInfo(thread) });
    this.decide(thread, accepted);
    return toInfo(this.require(thread.id));
  }

  async send(threadId: string, message: MessageInput): Promise<SendResult> {
    this.require(threadId);
    const live = this.liveOf(threadId);
    const prepared = this.accept(message);
    prepared.catch(() => undefined);
    const decision = live.acceptTail.then(async () => this.decide(this.require(threadId), await prepared));
    live.acceptTail = decision.then(
      () => undefined,
      () => undefined,
    );
    return decision;
  }

  editPending(threadId: string, pendingId: string, text: string): void {
    const thread = this.require(threadId);
    const message = this.findPending(thread, pendingId);
    if (text.trim().length === 0 && !message.attachments?.length) throw new SessionError('bad-request', 'text required');
    message.text = text;
    this.emit(thread, { type: 'pending.edited', pendingId, text });
    this.persist(thread);
  }

  removePending(threadId: string, pendingId: string): void {
    const thread = this.require(threadId);
    this.findPending(thread, pendingId);
    thread.pending = thread.pending.filter((message) => message.id !== pendingId);
    this.emit(thread, { type: 'pending.removed', pendingId });
    this.publishThread(thread);
  }

  flushPending(threadId: string): SendResult {
    const thread = this.require(threadId);
    const live = this.liveOf(threadId);
    if (live.turn || live.queued !== null) {
      throw new SessionError('conflict', 'the thread is working: pending messages are delivered at the next cut point');
    }
    if (thread.pending.length === 0) throw new SessionError('conflict', 'no pending messages');
    this.launchTurn(thread);
    return { delivery: 'started' };
  }

  async interrupt(threadId: string): Promise<void> {
    const thread = this.require(threadId);
    const live = this.liveOf(threadId);
    const queuedMessages = live.queued;
    const wasQueued = queuedMessages !== null;
    if (!live.turn && !wasQueued) return;
    // All in-memory work first; disk goes last and is not awaited.
    live.queued = null;
    live.interrupted = true;
    this.setStatus(thread, 'interrupted');
    if (queuedMessages) this.restorePending(thread, queuedMessages.map((message) => message.id));
    this.settleThread(threadId, 'interrupted');
    if (wasQueued) this.drain(thread.channelId);
    try {
      await live.turn?.interrupt();
    } catch (error) {
      reportError(error);
    }
  }

  setLink(threadId: string, target: ThreadLinkTarget): ThreadInfo {
    const thread = this.require(threadId);
    if (!linkTargetExists(this.deps.snapshot(), target)) throw new SessionError('not-found', 'the link target does not exist');
    thread.link = { target, source: 'manual' };
    this.publishThread(thread);
    return toInfo(thread);
  }

  async setOptions(threadId: string, patch: Partial<Omit<ThreadOptions, 'agent'>>): Promise<ThreadInfo> {
    const thread = this.require(threadId);
    const { agent: _fixed, ...allowed } = patch as Partial<ThreadOptions>;
    thread.options = { ...thread.options, ...allowed };
    this.persist(thread);
    this.deps.broadcast({ kind: 'thread.updated', thread: toInfo(thread) });
    return toInfo(thread);
  }

  respondApproval(approvalId: string, decision: 'allow' | 'deny', reason: string | undefined, scope: 'once' | 'thread'): void {
    const pending = this.approvals.get(approvalId);
    if (!pending) throw new SessionError('not-found', `no pending approval ${approvalId}`);
    const remembered = decision === 'allow' && scope === 'thread' ? ruleOf(pending.always) : null;
    if (remembered) this.rememberRule(pending.threadId, remembered);
    pending.settle(
      decision === 'allow' ? { behavior: 'allow' } : { behavior: 'deny', message: reason ?? 'denied by the user' },
      remembered ?? undefined,
    );
  }

  private rememberRule(threadId: string, rule: AlwaysRule): void {
    const live = this.liveOf(threadId);
    const key = JSON.stringify(rule);
    if (!live.alwaysAllow.some((known) => JSON.stringify(known) === key)) live.alwaysAllow.push(rule);
  }

  /** After a restart: announces the lost approvals and the interruption of threads that were busy. */
  async recover(): Promise<void> {
    for (const threadId of this.deps.store.recoveredThreadIds()) {
      const thread = this.deps.store.get(threadId);
      if (!thread) continue;
      const history = await this.deps.store.history(threadId, 0);
      const resolved = new Set<string>();
      for (const { event } of history) if (event.type === 'approval.resolved') resolved.add(event.approvalId);
      for (const { event } of history) {
        if (event.type === 'approval.requested' && !resolved.has(event.approvalId)) {
          this.emit(thread, { type: 'approval.resolved', approvalId: event.approvalId, decision: 'deny', reason: 'the bridge restarted' });
        }
      }
      this.emit(thread, { type: 'session.status', status: 'interrupted' });
    }
  }

  // ── internos ─────────────────────────────────────────────────────────────

  private require(threadId: string): StoredThread {
    const thread = this.deps.store.get(threadId);
    if (!thread) throw new SessionError('not-found', `thread ${threadId} does not exist`);
    return thread;
  }

  private liveOf(threadId: string): Live {
    let live = this.live.get(threadId);
    if (!live) {
      live = { turn: null, queued: null, delivered: new Map(), deliveredIds: new Set(), queuedAt: 0, alwaysAllow: [], hookDenied: new Map(), interrupted: false, gen: 0, writes: false, acceptTail: Promise.resolve() };
      this.live.set(threadId, live);
    }
    return live;
  }

  private writes(thread: StoredThread): boolean {
    return thread.options.permissionMode !== 'plan';
  }

  /** Fire-and-forget persistence: the store already reports its errors via onError. */
  private persist(thread: StoredThread): void {
    this.deps.store.upsert(thread).catch(reportError);
  }

  private settleThread(threadId: string, message: string): void {
    for (const pending of [...this.approvals.values()]) {
      if (pending.threadId === threadId) pending.settle({ behavior: 'deny', message });
    }
  }

  private blocked(thread: StoredThread): boolean {
    if (!this.liveOf(thread.id).writes) return false;
    const scope = writeScopeOf(thread.channelId);
    return this.deps.store.list().some((other) => {
      if (other.id === thread.id || writeScopeOf(other.channelId) !== scope) return false;
      const l = this.live.get(other.id);
      return !!l?.turn && l.writes;
    });
  }

  private async accept(input: MessageInput): Promise<AcceptedMessage> {
    const attachments = await Promise.all((input.attachments ?? []).map((upload) => this.deps.attachments.put(upload)));
    return { text: input.text, attachments, refs: this.vettedRefs(input.refs) };
  }

  private vettedRefs(refs: PromptRefs | undefined): PromptRefs {
    const snapshot = this.deps.snapshot();
    const known = (ids: string[], catalog: { id: string }[]) => [...new Set(ids)].filter((id) => catalog.some((entry) => entry.id === id));
    return { agents: known(refs?.agents ?? [], snapshot.agents), skills: known(refs?.skills ?? [], snapshot.skills) };
  }

  private decide(thread: StoredThread, accepted: AcceptedMessage): SendResult {
    const live = this.liveOf(thread.id);
    if (live.turn || live.queued !== null) return this.addPending(thread, accepted);
    this.launchTurn(thread, accepted);
    return { delivery: 'started' };
  }

  private catalogView() {
    const { agents, skills } = this.deps.snapshot();
    return { agents, skills };
  }

  private launchTurn(thread: StoredThread, newMessage?: AcceptedMessage): void {
    const live = this.liveOf(thread.id);
    live.delivered.clear();
    const prompts = this.deliverAll(thread, 'next-turn');
    if (newMessage !== undefined) prompts.push(this.deliverNew(thread, newMessage));
    live.writes = this.writes(thread);
    live.interrupted = false;
    if (this.blocked(thread)) {
      live.queued = prompts;
      live.queuedAt = ++this.queueCounter;
      this.setStatus(thread, 'queued');
      return;
    }
    this.start(thread, prompts);
  }

  private addPending(thread: StoredThread, accepted: AcceptedMessage): SendResult {
    if (thread.pending.length >= MAX_PENDING_PER_THREAD) throw new SessionError('conflict', 'too many pending messages');
    const message: PendingMessage = { id: this.newId(), text: accepted.text, createdAt: this.now(), ...extrasOf(accepted) };
    thread.pending.push(message);
    this.emit(thread, { type: 'pending.added', pendingId: message.id, text: message.text, ...extrasOf(accepted) });
    this.publishThread(thread);
    return { delivery: 'pending', pendingId: message.id };
  }

  private findPending(thread: StoredThread, pendingId: string): PendingMessage {
    const message = thread.pending.find((candidate) => candidate.id === pendingId);
    if (message) return message;
    if (this.liveOf(thread.id).deliveredIds.has(pendingId)) throw new SessionError('conflict', 'already delivered');
    throw new SessionError('not-found', `no pending message ${pendingId}`);
  }

  private deliverNew(thread: StoredThread, accepted: AcceptedMessage): OutgoingMessage {
    this.emit(thread, { type: 'user.message', text: accepted.text, ...extrasOf(accepted) });
    return { id: this.newId(), prompt: buildTurnPrompt(accepted, this.catalogView()) };
  }

  private deliverAll(thread: StoredThread, delivery: 'cut-point' | 'next-turn', textOnly = false): OutgoingMessage[] {
    const live = this.liveOf(thread.id);
    const taken = thread.pending.filter((message) => !textOnly || !message.attachments?.length);
    const delivered = taken.map((message) => {
      thread.pending = thread.pending.filter((candidate) => candidate.id !== message.id);
      live.delivered.set(message.id, message);
      live.deliveredIds.add(message.id);
      const accepted = { text: message.text, attachments: message.attachments ?? [], refs: message.refs ?? { agents: [], skills: [] } };
      this.emit(thread, { type: 'user.message', text: message.text, pendingId: message.id, delivery, ...extrasOf(accepted) });
      return { id: message.id, prompt: buildTurnPrompt(accepted, this.catalogView()) };
    });
    if (taken.length > 0) this.publishThread(thread);
    return delivered;
  }

  private collectPending(thread: StoredThread, gen: number, at: 'cut-point' | 'turn-end', textOnly = false): OutgoingMessage[] {
    const live = this.liveOf(thread.id);
    if (live.interrupted || live.gen !== gen) return [];
    return this.deliverAll(thread, at === 'cut-point' ? 'cut-point' : 'next-turn', textOnly);
  }

  private revertPending(thread: StoredThread, gen: number, ids: string[]): void {
    if (this.liveOf(thread.id).gen !== gen) return;
    this.restorePending(thread, ids);
  }

  private restorePending(thread: StoredThread, ids: string[]): void {
    const live = this.liveOf(thread.id);
    const restored = ids.flatMap((id) => {
      const message = live.delivered.get(id);
      return message ? [message] : [];
    });
    if (restored.length === 0) return;
    for (const message of restored) {
      live.delivered.delete(message.id);
      live.deliveredIds.delete(message.id);
      this.emit(thread, { type: 'pending.reverted', pendingId: message.id, reason: 'interrupt' });
    }
    thread.pending = [...restored, ...thread.pending];
    this.publishThread(thread);
  }

  private systemPrefixInput(): { systemPrefix?: string } {
    const systemPrefix = this.stablePrefix();
    return systemPrefix.length > 0 ? { systemPrefix } : {};
  }

  private sessionOwnedByAnotherThread(threadId: string, sessionId: string): boolean {
    return this.deps.store.list().some((other) => other.id !== threadId && other.engineSessionId === sessionId);
  }

  private publishThread(thread: StoredThread): void {
    this.tracker.onThread(toInfo(thread));
    this.deps.broadcast({ kind: 'thread.updated', thread: toInfo(thread) });
    this.persist(thread);
  }

  private start(thread: StoredThread, prompts: OutgoingMessage[]): void {
    const live = this.liveOf(thread.id);
    live.interrupted = false;
    const gen = ++live.gen;
    this.setStatus(thread, 'running');
    let turn: EngineTurn;
    try {
      turn = this.deps.engine.startTurn(
        {
          threadId: thread.id,
          prompts,
          options: thread.options,
          resumeSessionId: thread.engineSessionId,
          cwd: this.deps.root,
          ...this.systemPrefixInput(),
        },
        {
          emit: (event) => this.emit(thread, event, true),
          onSessionId: (id) => {
            if (thread.engineSessionId === id) return;
            if (this.sessionOwnedByAnotherThread(thread.id, id)) {
              reportError(new Error(`session ${id} already belongs to another thread`));
              return;
            }
            thread.engineSessionId = id;
            this.publishThread(thread);
          },
          requestApproval: (request, signal) => this.requestApproval(thread, gen, request, signal),
          judgeTool: (toolName, input, ctx) => this.judgeTool(thread, gen, toolName, input, ctx),
          readAttachment: (ref: AttachmentRef) => this.deps.attachments.read(ref.sha256, ref.mime).catch(() => null),
          collectPending: (at, opts) => this.collectPending(thread, gen, at, opts?.textOnly === true),
          revertPending: (ids) => this.revertPending(thread, gen, ids),
        },
      );
    } catch (error) {
      this.finish(thread, true, error);
      return;
    }
    live.turn = turn;
    turn.done
      .then(
        () => this.finish(thread, false, null),
        (error: unknown) => this.finish(thread, true, error),
      )
      .catch(reportError);
  }

  private finish(thread: StoredThread, failed: boolean, error: unknown): void {
    this.liveOf(thread.id).turn = null;
    this.settleThread(thread.id, 'turn ended');
    if (failed) {
      if (thread.status !== 'interrupted' && thread.status !== 'error') {
        const message = error instanceof Error ? error.message : String(error);
        this.setStatus(thread, 'error', { code: 'engine', message: message.slice(0, 500) });
      }
    } else if (thread.status === 'running' || thread.status === 'waiting-approval') {
      this.setStatus(thread, 'idle');
    }
    this.drain(thread.channelId);
    if (!failed && !this.liveOf(thread.id).interrupted && thread.status === 'idle') this.resumeWithPending(thread);
  }

  private resumeWithPending(thread: StoredThread): void {
    const live = this.liveOf(thread.id);
    if (thread.pending.length === 0 || live.turn || live.queued !== null) return;
    this.launchTurn(thread);
  }

  private drain(channelId: string): void {
    const scope = writeScopeOf(channelId);
    const waiting = this.deps.store
      .list()
      .filter((t) => writeScopeOf(t.channelId) === scope)
      .filter((t) => this.live.get(t.id)?.queued != null)
      .sort((a, b) => this.liveOf(a.id).queuedAt - this.liveOf(b.id).queuedAt);
    for (const thread of waiting) {
      const live = this.liveOf(thread.id);
      if (live.queued === null) continue; // already started by a re-entry
      if (this.blocked(thread)) break;
      const prompts = live.queued;
      live.queued = null;
      this.start(thread, prompts);
    }
  }

  /** Announces a SPEC GATE deny with the same event pair the UI sees for any approval. */
  private announceDeny(thread: StoredThread, author: ApprovalRequest['author'], toolName: string, input: Record<string, unknown>, reason: string): void {
    const approvalId = this.newId();
    const diff = diffFor(toolName, input);
    this.emit(thread, {
      type: 'approval.requested',
      approvalId,
      author,
      tool: toolName,
      summary: summarizeTool(toolName, input),
      ...(diff ? { diff } : {}),
      ...serializeInput(input),
    });
    this.emit(thread, { type: 'approval.resolved', approvalId, decision: 'deny', reason });
  }

  /** Synchronous SPEC GATE (engine PreToolUse hook): independent of canUseTool and the permission mode. */
  private judgeTool(thread: StoredThread, gen: number, toolName: string, input: Record<string, unknown>, ctx?: JudgeContext): ToolVerdict {
    const live = this.liveOf(thread.id);
    if (live.interrupted || live.gen !== gen) return { kind: 'deny', reason: 'interrupted' };
    const target = editTargetOf(toolName, input);
    if (!target) return { kind: 'allow' };
    const verdict = judgeEdit(this.deps.snapshot(), this.deps.root, target);
    if (verdict.kind !== 'deny') return verdict;
    const author = ctx?.author ?? { agent: thread.agent, parentToolUseId: null };
    if (ctx?.toolUseId) live.hookDenied.set(ctx.toolUseId, verdict.reason);
    this.announceDeny(thread, author, toolName, input, verdict.reason);
    return verdict;
  }

  /**
   * An interrupted turn (or one from an old generation, or with an already-aborted signal) gets an immediate deny
   * and emits no approval events: it never overrides `interrupted` nor hangs.
   */
  private async requestApproval(thread: StoredThread, gen: number, request: ApprovalRequest, signal: AbortSignal): Promise<ApprovalDecision> {
    const live = this.liveOf(thread.id);
    if (live.interrupted || live.gen !== gen) return { behavior: 'deny', message: 'interrupted' };
    if (signal.aborted) return { behavior: 'deny', message: 'aborted' };

    const hookReason = request.toolUseId ? live.hookDenied.get(request.toolUseId) : undefined;
    if (hookReason !== undefined) return { behavior: 'deny', message: hookReason };

    let gateWarning: string | undefined;
    const target = editTargetOf(request.toolName, request.input);
    if (target) {
      let verdict = judgeEdit(this.deps.snapshot(), this.deps.root, target);
      if (verdict.kind === 'deny' && this.deps.refreshSnapshot) {
        // The snapshot may lag behind due to the watcher debounce: a single re-read before denying.
        await this.deps.refreshSnapshot().catch(reportError);
        if (live.interrupted || live.gen !== gen) return { behavior: 'deny', message: 'interrupted' };
        if (signal.aborted) return { behavior: 'deny', message: 'aborted' };
        verdict = judgeEdit(this.deps.snapshot(), this.deps.root, target);
      }
      if (verdict.kind === 'deny') {
        this.announceDeny(thread, request.author, request.toolName, request.input, verdict.reason);
        return { behavior: 'deny', message: verdict.reason };
      }
      if (verdict.kind === 'warn') gateWarning = verdict.reason;
    }
    if (!gateWarning && live.alwaysAllow.some((rule) => matchesRule(rule, request.toolName, request.input))) return { behavior: 'allow' };
    const always = alwaysOfferOf(request.toolName, request.input, gateWarning);

    const summary = summarizeTool(request.toolName, request.input);
    const diff = diffFor(request.toolName, request.input);
    const extra = diff ? { diff } : {};
    const approvalId = this.newId();
    // The pending approval is registered BEFORE announcing it: a client may answer as soon as it sees the event.
    const decision = new Promise<ApprovalDecision>((resolve) => {
      const onAbort = () => settle({ behavior: 'deny', message: 'aborted' });
      const settle = (result: ApprovalDecision, remembered?: AlwaysRule) => {
        if (!this.approvals.delete(approvalId)) return;
        signal.removeEventListener('abort', onAbort);
        this.emit(thread, {
          type: 'approval.resolved',
          approvalId,
          decision: result.behavior,
          ...(result.behavior === 'deny' ? { reason: result.message } : {}),
          ...(remembered ? { remembered } : {}),
        });
        const stillWaiting = [...this.approvals.values()].some((p) => p.threadId === thread.id);
        if (thread.status === 'waiting-approval' && !stillWaiting) this.setStatus(thread, 'running');
        resolve(result);
      };
      this.approvals.set(approvalId, { threadId: thread.id, always, settle });
      signal.addEventListener('abort', onAbort, { once: true });
    });
    // State before the broadcast; if it resolves synchronously during the broadcast, settle returns it to running.
    if (thread.status === 'running') this.setStatus(thread, 'waiting-approval');
    this.emit(thread, {
      type: 'approval.requested',
      approvalId,
      author: request.author,
      tool: request.toolName,
      summary,
      ...extra,
      ...serializeInput(request.input),
      ...(gateWarning ? { gateWarning } : {}),
      always,
    });
    return decision;
  }

  /** `fromEngine`: engine session.status events do not override `interrupted`. */
  private emit(thread: StoredThread, event: ThreadEvent, fromEngine = false): void {
    if (event.type === 'session.status') {
      if (fromEngine && thread.status === 'interrupted') return;
      this.applyStatus(thread, event.status);
    }
    const seq = this.deps.store.append(thread.id, event);
    this.deps.broadcast({ kind: 'thread.event', threadId: thread.id, seq, event });
    this.tracker.onEvent(thread.id, event);
    this.publishPresence();
  }

  private setStatus(thread: StoredThread, status: SessionStatus, error?: { code: string; message: string }): void {
    if (thread.status === status) return;
    this.emit(thread, { type: 'session.status', status, ...(error ? { error } : {}) });
  }

  private applyStatus(thread: StoredThread, status: SessionStatus): void {
    thread.status = status;
    thread.lastActivity = this.now();
    this.publishThread(thread);
  }

  private publishPresence(): void {
    const presence = this.tracker.compute();
    const key = JSON.stringify(presence);
    if (key === this.lastPresence) return;
    this.lastPresence = key;
    this.deps.broadcast({ kind: 'presence.changed', presence });
  }
}
