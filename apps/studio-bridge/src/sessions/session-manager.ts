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
  /** Orden FIFO monótono de la cola del canal. */
  queuedAt: number;
  alwaysAllow: Set<string>;
  /** Se levanta en interrupt(), se baja al arrancar un turno nuevo. */
  interrupted: boolean;
  /** Generación del turno: invalida callbacks tardíos de un turno anterior. */
  gen: number;
  /** Modo de escritura congelado al encolar/arrancar; setOptions sólo afecta al próximo turno. */
  writes: boolean;
}

interface PendingApproval {
  threadId: string;
  toolName: string;
  settle: (decision: ApprovalDecision) => void;
}

const toInfo = ({ engineSessionId: _ignored, ...info }: StoredThread): ThreadInfo => info;
const reportError = (error: unknown): void => console.error('[sdd-studio] session manager:', error);

export class SessionManager {
  private readonly live = new Map<string, Live>();
  private readonly approvals = new Map<string, PendingApproval>();
  private readonly tracker: PresenceTracker;
  private readonly newId: () => string;
  private readonly now: () => string;
  private lastPresence = '';
  private queueCounter = 0;

  constructor(private readonly deps: SessionManagerDeps) {
    this.newId = deps.newId ?? randomUUID;
    this.now = deps.now ?? (() => new Date().toISOString());
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
    this.persist(thread);
    this.tracker.onThread(toInfo(thread));
    await this.send(thread.id, args.text);
    return toInfo(this.require(thread.id));
  }

  async send(threadId: string, text: string): Promise<void> {
    const thread = this.require(threadId);
    const live = this.liveOf(threadId);
    if (live.turn || live.queued !== null) throw new SessionError('conflict', 'el hilo está ocupado: esperá o interrumpilo');
    live.writes = this.writes(thread);
    live.interrupted = false;
    this.emit(thread, { type: 'user.message', text });
    if (this.blocked(thread)) {
      live.queued = text;
      live.queuedAt = ++this.queueCounter;
      this.setStatus(thread, 'queued');
      return;
    }
    this.start(thread, text);
  }

  async interrupt(threadId: string): Promise<void> {
    const thread = this.require(threadId);
    const live = this.liveOf(threadId);
    const wasQueued = live.queued !== null;
    if (!live.turn && !wasQueued) return;
    // Todo el trabajo en memoria primero; el disco va último y sin esperar.
    live.queued = null;
    live.interrupted = true;
    this.setStatus(thread, 'interrupted');
    this.settleThread(threadId, 'interrupted');
    if (wasQueued) this.drain(thread.channelId);
    try {
      await live.turn?.interrupt();
    } catch (error) {
      reportError(error);
    }
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
      live = { turn: null, queued: null, queuedAt: 0, alwaysAllow: new Set(), interrupted: false, gen: 0, writes: false };
      this.live.set(threadId, live);
    }
    return live;
  }

  private writes(thread: StoredThread): boolean {
    return thread.options.permissionMode !== 'plan';
  }

  /** Persistencia fire-and-forget: el store ya reporta sus errores por onError. */
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
    return this.deps.store.list(thread.channelId).some((other) => {
      if (other.id === thread.id) return false;
      const l = this.live.get(other.id);
      return !!l?.turn && l.writes;
    });
  }

  private start(thread: StoredThread, text: string): void {
    const live = this.liveOf(thread.id);
    live.interrupted = false;
    const gen = ++live.gen;
    this.setStatus(thread, 'running');
    let turn: EngineTurn;
    try {
      turn = this.deps.engine.startTurn(
        { threadId: thread.id, text, options: thread.options, resumeSessionId: thread.engineSessionId, cwd: this.deps.root },
        {
          emit: (event) => this.emit(thread, event, true),
          onSessionId: (id) => {
            if (thread.engineSessionId === id) return;
            thread.engineSessionId = id;
            this.persist(thread);
          },
          requestApproval: (request, signal) => this.requestApproval(thread, gen, request, signal),
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
  }

  private drain(channelId: string): void {
    const waiting = this.deps.store
      .list(channelId)
      .filter((t) => this.live.get(t.id)?.queued != null)
      .sort((a, b) => this.liveOf(a.id).queuedAt - this.liveOf(b.id).queuedAt);
    for (const thread of waiting) {
      const live = this.liveOf(thread.id);
      if (live.queued === null) continue; // ya arrancado por una reentrada
      if (this.blocked(thread)) break;
      const text = live.queued;
      live.queued = null;
      this.start(thread, text);
    }
  }

  /**
   * Un turno interrumpido (o de una generación vieja, o con señal ya abortada) recibe deny inmediato
   * y no emite eventos de aprobación: nunca pisa `interrupted` ni queda colgado.
   */
  private async requestApproval(thread: StoredThread, gen: number, request: ApprovalRequest, signal: AbortSignal): Promise<ApprovalDecision> {
    const live = this.liveOf(thread.id);
    if (live.interrupted || live.gen !== gen) return { behavior: 'deny', message: 'interrupted' };
    if (signal.aborted) return { behavior: 'deny', message: 'aborted' };

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
    if (!gateWarning && live.alwaysAllow.has(request.toolName)) return { behavior: 'allow' };

    const approvalId = this.newId();
    // Se registra la aprobación pendiente ANTES de anunciarla: un cliente puede responder en cuanto ve el evento.
    const decision = new Promise<ApprovalDecision>((resolve) => {
      const onAbort = () => settle({ behavior: 'deny', message: 'aborted' });
      const settle = (result: ApprovalDecision) => {
        if (!this.approvals.delete(approvalId)) return;
        signal.removeEventListener('abort', onAbort);
        this.emit(thread, {
          type: 'approval.resolved',
          approvalId,
          decision: result.behavior,
          ...(result.behavior === 'deny' ? { reason: result.message } : {}),
        });
        const stillWaiting = [...this.approvals.values()].some((p) => p.threadId === thread.id);
        if (thread.status === 'waiting-approval' && !stillWaiting) this.setStatus(thread, 'running');
        resolve(result);
      };
      this.approvals.set(approvalId, { threadId: thread.id, toolName: request.toolName, settle });
      signal.addEventListener('abort', onAbort, { once: true });
    });
    // Estado antes del broadcast; si se resuelve síncronamente durante el broadcast, settle lo devuelve a running.
    if (thread.status === 'running') this.setStatus(thread, 'waiting-approval');
    this.emit(thread, {
      type: 'approval.requested',
      approvalId,
      author: request.author,
      tool: request.toolName,
      summary,
      ...extra,
      ...(gateWarning ? { gateWarning } : {}),
    });
    return decision;
  }

  /** `fromEngine`: los session.status del motor no pisan `interrupted`. */
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
    this.tracker.onThread(toInfo(thread));
    this.deps.broadcast({ kind: 'thread.updated', thread: toInfo(thread) });
    this.persist(thread);
  }

  private publishPresence(): void {
    const presence = this.tracker.compute();
    const key = JSON.stringify(presence);
    if (key === this.lastPresence) return;
    this.lastPresence = key;
    this.deps.broadcast({ kind: 'presence.changed', presence });
  }
}
