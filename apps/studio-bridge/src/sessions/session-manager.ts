import { randomUUID } from 'node:crypto';
import type {
  Presence,
  ServerEvent,
  SessionStatus,
  ThreadEvent,
  ThreadInfo,
  ThreadOptions,
  WorkspaceSnapshot,
} from '@sdd-studio/protocol';
import { diffFor, summarizeTool } from '../engine/tool-summary';
import type { AgentEngine, ApprovalDecision, ApprovalRequest, EngineTurn } from '../engine/types';
import { editTargetOf, judgeEdit } from '../gate/judge';
import { PresenceTracker } from './presence';
import type { HistoryEntry, StoredThread, ThreadStore } from './store';

export class SessionError extends Error {
  constructor(
    readonly code: 'not-found' | 'conflict' | 'bad-request',
    message: string,
  ) {
    super(message);
  }
}

export interface SessionManagerDeps {
  root: string;
  engine: AgentEngine;
  store: ThreadStore;
  snapshot: () => WorkspaceSnapshot;
  broadcast: (message: ServerEvent) => void;
  newId?: () => string;
  now?: () => string;
}

interface Live {
  turn: EngineTurn | null;
  queued: string | null;
  alwaysAllow: Set<string>;
}

interface PendingApproval {
  threadId: string;
  toolName: string;
  settle: (decision: ApprovalDecision) => void;
}

const toInfo = ({ engineSessionId: _ignored, ...info }: StoredThread): ThreadInfo => info;

export class SessionManager {
  private readonly live = new Map<string, Live>();
  private readonly approvals = new Map<string, PendingApproval>();
  private readonly tracker: PresenceTracker;
  private readonly newId: () => string;
  private readonly now: () => string;
  private lastPresence = '';

  constructor(private readonly deps: SessionManagerDeps) {
    this.newId = deps.newId ?? randomUUID;
    this.now = deps.now ?? (() => new Date().toISOString());
    this.tracker = new PresenceTracker(() => deps.snapshot().agents.map((a) => a.id));
  }

  list(channelId?: string): ThreadInfo[] {
    return this.deps.store.list(channelId).map(toInfo);
  }

  history(threadId: string, sinceSeq: number): Promise<HistoryEntry[]> {
    this.require(threadId);
    return this.deps.store.history(threadId, sinceSeq);
  }

  presence(): Presence[] {
    return this.tracker.compute();
  }

  async createThread(args: { channelId: string; options: ThreadOptions; text: string }): Promise<ThreadInfo> {
    const now = this.now();
    const thread: StoredThread = {
      id: this.newId(),
      channelId: args.channelId,
      title: (args.text.split('\n')[0] ?? '').slice(0, 80),
      agent: args.options.agent,
      options: args.options,
      status: 'idle',
      createdAt: now,
      lastActivity: now,
      engineSessionId: null,
    };
    await this.deps.store.upsert(thread);
    await this.send(thread.id, args.text);
    return toInfo(this.require(thread.id));
  }

  async send(threadId: string, text: string): Promise<void> {
    const thread = this.require(threadId);
    const live = this.liveOf(threadId);
    if (live.turn || live.queued !== null) throw new SessionError('conflict', 'el hilo está ocupado: esperá o interrumpilo');
    this.emit(thread, { type: 'user.message', text });
    if (this.blocked(thread)) {
      live.queued = text;
      await this.setStatus(thread, 'queued');
      return;
    }
    this.start(thread, text);
  }

  async interrupt(threadId: string): Promise<void> {
    const thread = this.require(threadId);
    const live = this.liveOf(threadId);
    const wasQueued = live.queued !== null;
    live.queued = null;
    if (!live.turn && !wasQueued) return;
    await this.setStatus(thread, 'interrupted');
    for (const [, pending] of this.approvals) {
      if (pending.threadId === threadId) pending.settle({ behavior: 'deny', message: 'interrupted' });
    }
    await live.turn?.interrupt();
    if (wasQueued) this.drain(thread.channelId);
  }

  async setOptions(threadId: string, patch: Partial<Omit<ThreadOptions, 'agent'>>): Promise<ThreadInfo> {
    const thread = this.require(threadId);
    const { agent: _fixed, ...allowed } = patch as Partial<ThreadOptions>;
    thread.options = { ...thread.options, ...allowed };
    await this.deps.store.upsert(thread);
    this.deps.broadcast({ kind: 'thread.updated', thread: toInfo(thread) });
    return toInfo(thread);
  }

  respondApproval(approvalId: string, decision: 'allow' | 'deny', reason: string | undefined, scope: 'once' | 'thread'): void {
    const pending = this.approvals.get(approvalId);
    if (!pending) throw new SessionError('not-found', `no hay una aprobación pendiente ${approvalId}`);
    if (decision === 'allow' && scope === 'thread') this.liveOf(pending.threadId).alwaysAllow.add(pending.toolName);
    pending.settle(decision === 'allow' ? { behavior: 'allow' } : { behavior: 'deny', message: reason ?? 'denegado por el usuario' });
  }

  // ── internos ─────────────────────────────────────────────────────────────

  private require(threadId: string): StoredThread {
    const thread = this.deps.store.get(threadId);
    if (!thread) throw new SessionError('not-found', `no existe el hilo ${threadId}`);
    return thread;
  }

  private liveOf(threadId: string): Live {
    let live = this.live.get(threadId);
    if (!live) {
      live = { turn: null, queued: null, alwaysAllow: new Set() };
      this.live.set(threadId, live);
    }
    return live;
  }

  private writes(thread: StoredThread): boolean {
    return thread.options.permissionMode !== 'plan';
  }

  private blocked(thread: StoredThread): boolean {
    if (!this.writes(thread)) return false;
    return this.deps.store
      .list(thread.channelId)
      .some((other) => other.id !== thread.id && this.writes(other) && this.live.get(other.id)?.turn);
  }

  private start(thread: StoredThread, text: string): void {
    const live = this.liveOf(thread.id);
    void this.setStatus(thread, 'running');
    const turn = this.deps.engine.startTurn(
      { threadId: thread.id, text, options: thread.options, resumeSessionId: thread.engineSessionId, cwd: this.deps.root },
      {
        emit: (event) => this.emit(thread, event),
        onSessionId: (id) => {
          if (thread.engineSessionId === id) return;
          thread.engineSessionId = id;
          void this.deps.store.upsert(thread);
        },
        requestApproval: (request, signal) => this.requestApproval(thread, request, signal),
      },
    );
    live.turn = turn;
    turn.done.then(
      () => this.finish(thread, null),
      (error: unknown) => this.finish(thread, error),
    );
  }

  private async finish(thread: StoredThread, error: unknown): Promise<void> {
    this.liveOf(thread.id).turn = null;
    if (error && thread.status !== 'interrupted') {
      const message = error instanceof Error ? error.message : String(error);
      this.emit(thread, { type: 'session.status', status: 'error', error: { code: 'engine', message: message.slice(0, 500) } });
    } else if (thread.status === 'running' || thread.status === 'waiting-approval') {
      await this.setStatus(thread, 'idle');
    }
    this.drain(thread.channelId);
  }

  private drain(channelId: string): void {
    const waiting = this.deps.store
      .list(channelId)
      .filter((t) => this.live.get(t.id)?.queued != null)
      .sort((a, b) => a.lastActivity.localeCompare(b.lastActivity));
    for (const thread of waiting) {
      if (this.blocked(thread)) break;
      const live = this.liveOf(thread.id);
      const text = live.queued!;
      live.queued = null;
      this.start(thread, text);
    }
  }

  private async requestApproval(thread: StoredThread, request: ApprovalRequest, signal: AbortSignal): Promise<ApprovalDecision> {
    const summary = summarizeTool(request.toolName, request.input);
    const diff = diffFor(request.toolName, request.input);
    const extra = diff ? { diff } : {};
    let gateWarning: string | undefined;
    const target = editTargetOf(request.toolName, request.input);
    if (target) {
      const verdict = judgeEdit(this.deps.snapshot(), this.deps.root, target);
      if (verdict.kind === 'deny') {
        const approvalId = this.newId();
        this.emit(thread, { type: 'approval.requested', approvalId, author: request.author, tool: request.toolName, summary, ...extra });
        this.emit(thread, { type: 'approval.resolved', approvalId, decision: 'deny', reason: verdict.reason });
        return { behavior: 'deny', message: verdict.reason };
      }
      if (verdict.kind === 'warn') gateWarning = verdict.reason;
    }
    if (!gateWarning && this.liveOf(thread.id).alwaysAllow.has(request.toolName)) return { behavior: 'allow' };

    const approvalId = this.newId();
    // Se registra la aprobación pendiente ANTES de anunciarla: un cliente puede responder en cuanto ve el evento.
    const decision = new Promise<ApprovalDecision>((resolve) => {
      const onAbort = () => settle({ behavior: 'deny', message: 'aborted' });
      const settle = (decision: ApprovalDecision) => {
        if (!this.approvals.delete(approvalId)) return;
        signal.removeEventListener('abort', onAbort);
        this.emit(thread, {
          type: 'approval.resolved',
          approvalId,
          decision: decision.behavior,
          ...(decision.behavior === 'deny' ? { reason: decision.message } : {}),
        });
        const stillWaiting = [...this.approvals.values()].some((p) => p.threadId === thread.id);
        if (thread.status === 'waiting-approval' && !stillWaiting) void this.setStatus(thread, 'running');
        resolve(decision);
      };
      this.approvals.set(approvalId, { threadId: thread.id, toolName: request.toolName, settle });
      signal.addEventListener('abort', onAbort, { once: true });
    });
    this.emit(thread, {
      type: 'approval.requested',
      approvalId,
      author: request.author,
      tool: request.toolName,
      summary,
      ...extra,
      ...(gateWarning ? { gateWarning } : {}),
    });
    await this.setStatus(thread, 'waiting-approval');
    return decision;
  }

  private emit(thread: StoredThread, event: ThreadEvent): void {
    if (event.type === 'session.status') {
      if (thread.status === 'interrupted' && event.status === 'error') return;
      this.applyStatus(thread, event.status);
    }
    const seq = this.deps.store.append(thread.id, event);
    this.deps.broadcast({ kind: 'thread.event', threadId: thread.id, seq, event });
    this.tracker.onEvent(thread.id, event);
    this.publishPresence();
  }

  private async setStatus(thread: StoredThread, status: SessionStatus): Promise<void> {
    if (thread.status === status) return;
    this.emit(thread, { type: 'session.status', status });
    await this.deps.store.upsert(thread);
  }

  private applyStatus(thread: StoredThread, status: SessionStatus): void {
    thread.status = status;
    thread.lastActivity = this.now();
    this.tracker.onThread(toInfo(thread));
    this.deps.broadcast({ kind: 'thread.updated', thread: toInfo(thread) });
    void this.deps.store.upsert(thread);
  }

  private publishPresence(): void {
    const presence = this.tracker.compute();
    const key = JSON.stringify(presence);
    if (key === this.lastPresence) return;
    this.lastPresence = key;
    this.deps.broadcast({ kind: 'presence.changed', presence });
  }
}
