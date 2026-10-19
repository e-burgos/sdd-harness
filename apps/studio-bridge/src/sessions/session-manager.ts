import { randomUUID } from 'node:crypto';
import { dmAgentOfChannel } from '@sdd-studio/protocol';
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
import type { AgentEngine, ApprovalDecision, ApprovalRequest, EngineTurn, JudgeContext, ToolVerdict } from '../engine/types';
import { EDIT_TOOLS, editTargetOf, judgeEdit } from '../gate/judge';
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

/** Clave de "siempre en este hilo": null = el alcance 'thread' se trata como 'once'. */
function alwaysKeyOf(toolName: string, input: Record<string, unknown>): string | null {
  if (EDIT_TOOLS.has(toolName) || toolName.startsWith('mcp__')) return null;
  if (toolName === 'Bash') return typeof input.command === 'string' ? `Bash:${input.command}` : null;
  return toolName;
}

interface Live {
  turn: EngineTurn | null;
  queued: string | null;
  /** Orden FIFO monótono de la cola del canal. */
  queuedAt: number;
  alwaysAllow: Set<string>;
  /** toolUseId → motivo de los denies ya anunciados por el hook PreToolUse (evita duplicar el par). */
  hookDenied: Map<string, string>;
  /** Se levanta en interrupt(), se baja al arrancar un turno nuevo. */
  interrupted: boolean;
  /** Generación del turno: invalida callbacks tardíos de un turno anterior. */
  gen: number;
  /** Modo de escritura congelado al encolar/arrancar; setOptions sólo afecta al próximo turno. */
  writes: boolean;
}

interface PendingApproval {
  threadId: string;
  alwaysKey: string | null;
  settle: (decision: ApprovalDecision) => void;
}

/** Todos los canales dm:* comparten un único alcance de escritura; el resto usa su propio canal. */
const writeScopeOf = (channelId: string): string => (channelId.startsWith('dm:') ? 'dm' : channelId);

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
    const dmAgent = dmAgentOfChannel(args.channelId);
    if (dmAgent !== null && args.options.agent !== dmAgent) {
      throw new SessionError('bad-request', `un DM con ${dmAgent} sólo admite ese agente`);
    }
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
    this.deps.broadcast({ kind: 'thread.updated', thread: toInfo(thread) });
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
    if (decision === 'allow' && scope === 'thread' && pending.alwaysKey) this.liveOf(pending.threadId).alwaysAllow.add(pending.alwaysKey);
    pending.settle(decision === 'allow' ? { behavior: 'allow' } : { behavior: 'deny', message: reason ?? 'denegado por el usuario' });
  }

  /** Tras un reinicio: anuncia las aprobaciones perdidas y la interrupción de los hilos que estaban ocupados. */
  async recover(): Promise<void> {
    for (const threadId of this.deps.store.recoveredThreadIds()) {
      const thread = this.deps.store.get(threadId);
      if (!thread) continue;
      const history = await this.deps.store.history(threadId, 0);
      const resolved = new Set<string>();
      for (const { event } of history) if (event.type === 'approval.resolved') resolved.add(event.approvalId);
      for (const { event } of history) {
        if (event.type === 'approval.requested' && !resolved.has(event.approvalId)) {
          this.emit(thread, { type: 'approval.resolved', approvalId: event.approvalId, decision: 'deny', reason: 'el puente se reinició' });
        }
      }
      this.emit(thread, { type: 'session.status', status: 'interrupted' });
    }
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
      live = { turn: null, queued: null, queuedAt: 0, alwaysAllow: new Set(), hookDenied: new Map(), interrupted: false, gen: 0, writes: false };
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
    const scope = writeScopeOf(thread.channelId);
    return this.deps.store.list().some((other) => {
      if (other.id === thread.id || writeScopeOf(other.channelId) !== scope) return false;
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
          judgeTool: (toolName, input, ctx) => this.judgeTool(thread, gen, toolName, input, ctx),
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
    const scope = writeScopeOf(channelId);
    const waiting = this.deps.store
      .list()
      .filter((t) => writeScopeOf(t.channelId) === scope)
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

  /** Anuncia un deny del SPEC GATE con el mismo par de eventos que ve la UI para cualquier aprobación. */
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

  /** SPEC GATE síncrono (hook PreToolUse del motor): no depende de canUseTool ni del modo de permisos. */
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
   * Un turno interrumpido (o de una generación vieja, o con señal ya abortada) recibe deny inmediato
   * y no emite eventos de aprobación: nunca pisa `interrupted` ni queda colgado.
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
        // El snapshot puede estar atrasado por el debounce del watcher: una única relectura antes de negar.
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
    const alwaysKey = alwaysKeyOf(request.toolName, request.input);
    if (!gateWarning && alwaysKey && live.alwaysAllow.has(alwaysKey)) return { behavior: 'allow' };

    const summary = summarizeTool(request.toolName, request.input);
    const diff = diffFor(request.toolName, request.input);
    const extra = diff ? { diff } : {};
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
      this.approvals.set(approvalId, { threadId: thread.id, alwaysKey: alwaysKeyOf(request.toolName, request.input), settle });
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
      ...serializeInput(request.input),
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
