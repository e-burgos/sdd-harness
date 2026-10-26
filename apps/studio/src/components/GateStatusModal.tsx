'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ListChecks, MessageSquare, ShieldCheck, Users, Wrench, X } from 'lucide-react';
import type { ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import type { ConversationView } from '@/lib/conversation';
import { gateLabel, type ConversationGate } from '@/lib/conversation-gate';
import { useT, type TFunction } from '@/lib/i18n/i18n';
import { ConversationSessionInfo } from './mission-control/ConversationSessionInfo';

export interface GateStatusModalProps {
  open: boolean;
  onClose: () => void;
  thread: ThreadInfo | null;
  view: ConversationView | null;
  gate: ConversationGate;
  snapshot: WorkspaceSnapshot | null;
}

const LAST_EVENT_MAX = 240;
const TASK_STATUS_KEYS = { done: 'task.done', 'in-progress': 'task.in-progress', skipped: 'task.skipped', pending: 'task.pending' } as const;
const THREAD_STATUS_KEYS = {
  queued: 'status.queued',
  running: 'status.running',
  'waiting-approval': 'status.waiting-approval',
  idle: 'status.idle',
  interrupted: 'status.interrupted',
  error: 'status.error',
} as const;

const taskStatusLabel = (status: string, t: TFunction): string => (status in TASK_STATUS_KEYS ? t(TASK_STATUS_KEYS[status as keyof typeof TASK_STATUS_KEYS]) : status);
const clip = (text: string): string => (text.length > LAST_EVENT_MAX ? `${text.slice(0, LAST_EVENT_MAX - 1)}…` : text);

function Section({ icon: Icon, title, testId, children }: { icon: typeof Users; title: string; testId: string; children: ReactNode }) {
  return (
    <section data-testid={testId} className="rounded-xl border border-white/10 bg-white/5 p-3">
      <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase text-white/60">
        <Icon className="h-3 w-3" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}

function relatedFixes(view: ConversationView, gate: ConversationGate, snapshot: WorkspaceSnapshot | null): { fixId: string; status: string | null }[] {
  const ids = new Set(view.fixes.map((fix) => fix.fixId));
  if (gate.kind === 'fix') ids.add(gate.fixId);
  const statusOf = new Map((snapshot?.fixes ?? []).map((fix) => [fix.id, fix.status]));
  return [...ids].map((fixId) => ({ fixId, status: statusOf.get(fixId) ?? null }));
}

export function GateStatusModal({ open, onClose, thread, view, gate, snapshot }: GateStatusModalProps) {
  const { t } = useT();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const cycle = gate.kind === 'spec' && gate.cycle ? snapshot?.cycles.find((c) => c.specId === gate.specId && c.cycle === gate.cycle) : undefined;
  const fixes = view ? relatedFixes(view, gate, snapshot) : [];
  const lastEvent = view?.dialogues.at(-1);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('gate.modal.title')}
      data-testid="gate-status-modal"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-md sm:p-6"
    >
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-ink-950/95 text-white shadow-2xl backdrop-blur-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
            <h2 className="truncate text-base font-bold">{t('gate.modal.title')}</h2>
          </div>
          <button
            type="button"
            data-testid="gate-status-close"
            aria-label={t('gate.modal.close')}
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5 font-mono text-xs">
          {!thread || !view ? (
            <p data-testid="gate-status-no-conversation" className="text-white/60">
              {t('gate.modal.noConversation')}
            </p>
          ) : (
            <>
              <Section icon={MessageSquare} title={t('gate.modal.conversation')} testId="gate-status-conversation">
                <p className="truncate text-sm font-bold text-white" title={thread.title}>
                  {thread.title}
                </p>
                <dl className="mt-1 grid gap-0.5 text-white/70">
                  <div className="flex gap-2">
                    <dt className="text-white/50">{t('gate.modal.agent')}</dt>
                    <dd>{agentMeta(thread.agent).name}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-white/50">{t('gate.modal.state')}</dt>
                    <dd>{t(THREAD_STATUS_KEYS[thread.status])}</dd>
                  </div>
                </dl>
                <div className="mt-2">
                  <ConversationSessionInfo engineSessionId={view.engineSessionId} provider={view.provider} />
                </div>
              </Section>

              <Section icon={ShieldCheck} title={t('gate.modal.gate')} testId="gate-status-gate">
                <p data-testid="gate-status-gate-label" data-gate={gate.kind} className="font-bold text-emerald-300">
                  {gateLabel(gate, t)}
                </p>
                {gate.kind === 'idle' ? (
                  <p className="mt-1 text-white/60">{t('gate.modal.noGate')}</p>
                ) : (
                  <dl className="mt-1 grid gap-0.5 text-white/70">
                    {gate.kind === 'spec' && (
                      <>
                        <div className="flex gap-2">
                          <dt className="text-white/50">{t('gate.modal.spec')}</dt>
                          <dd className="break-all">{gate.specId}</dd>
                        </div>
                        {gate.cycle && (
                          <div className="flex gap-2">
                            <dt className="text-white/50">{t('gate.modal.cycle')}</dt>
                            <dd>{gate.cycle}</dd>
                          </div>
                        )}
                      </>
                    )}
                    {gate.kind === 'fix' && (
                      <div className="flex gap-2">
                        <dt className="text-white/50">{t('gate.modal.fix')}</dt>
                        <dd className="break-all">{gate.fixId}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </Section>

              {gate.kind === 'spec' && gate.cycle && (
                <Section icon={ListChecks} title={t('gate.modal.tasks')} testId="gate-status-tasks">
                  {!cycle || cycle.tasks.length === 0 ? (
                    <p className="text-white/60">{t('gate.modal.noTasks')}</p>
                  ) : (
                    <ul className="space-y-1">
                      {cycle.tasks.map((task) => (
                        <li key={task.id} className="flex items-center gap-2">
                          <span className="shrink-0 text-white/50">{task.id}</span>
                          <span className="min-w-0 flex-1 truncate" title={task.title}>
                            {task.title}
                          </span>
                          <span className="shrink-0 text-white/60">{taskStatusLabel(task.status, t)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              )}

              <Section icon={Wrench} title={t('gate.modal.fixes')} testId="gate-status-fixes">
                {fixes.length === 0 ? (
                  <p className="text-white/60">{t('gate.modal.noFixes')}</p>
                ) : (
                  <ul className="space-y-1">
                    {fixes.map((fix) => (
                      <li key={fix.fixId} className="flex items-center justify-between gap-2">
                        <span className="truncate" title={fix.fixId}>
                          {fix.fixId}
                        </span>
                        {fix.status && <span className="shrink-0 text-amber-300">{fix.status}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section icon={Users} title={t('gate.modal.agents')} testId="gate-status-agents">
                {view.participants.length === 0 ? (
                  <p className="text-white/60">{t('gate.modal.noAgents')}</p>
                ) : (
                  <ul className="space-y-1">
                    {view.participants.map((participant) => (
                      <li key={participant.agentId} className="flex items-center justify-between gap-2">
                        <span className="truncate">{agentMeta(participant.agentId).name}</span>
                        <span className="shrink-0 text-white/60">{t('gate.modal.events', { count: participant.events })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section icon={MessageSquare} title={t('gate.modal.lastEvent')} testId="gate-status-last-event">
                {lastEvent ? (
                  <>
                    <p className="text-white/60">
                      {agentMeta(lastEvent.from).name}
                      {lastEvent.to ? ` → ${agentMeta(lastEvent.to).name}` : ''}
                    </p>
                    <p className="mt-1 break-words text-white/80">{clip(lastEvent.text)}</p>
                  </>
                ) : (
                  <p className="text-white/60">{t('gate.modal.noEvents')}</p>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
