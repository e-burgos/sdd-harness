'use client';

import { SplitModal, type SplitModalItemStatus, type SplitModalSection } from '@e-burgos/tucu-ui';
import { useState, type ReactNode } from 'react';
import { ListChecks, MessageSquare, ShieldCheck, Users, Wrench } from 'lucide-react';
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

function Panel({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <section data-testid={testId} className="space-y-2 text-small">
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
  const [selectedId, setSelectedId] = useState<string>('gate');

  const cycle = gate.kind === 'spec' && gate.cycle ? snapshot?.cycles.find((c) => c.specId === gate.specId && c.cycle === gate.cycle) : undefined;
  const fixes = view ? relatedFixes(view, gate, snapshot) : [];
  const lastEvent = view?.dialogues.at(-1);
  const showTasks = gate.kind === 'spec' && !!gate.cycle;

  const tasksStatus: SplitModalItemStatus = !cycle || cycle.tasks.length === 0 ? 'neutral' : cycle.tasks.every((task) => task.status === 'done' || task.status === 'skipped') ? 'success' : 'warning';
  const fixesStatus: SplitModalItemStatus = fixes.some((fix) => fix.status && fix.status !== 'closed' && fix.status !== 'done') ? 'warning' : 'neutral';
  const gateStatus: SplitModalItemStatus = gate.kind === 'idle' ? 'neutral' : 'success';

  const sections: SplitModalSection[] =
    thread && view
      ? [
          {
            id: 'summary',
            items: [
              { id: 'conversation', label: t('gate.modal.conversation'), icon: <MessageSquare className="h-3.5 w-3.5" aria-hidden />, status: thread.status === 'error' ? 'danger' : 'neutral' },
              { id: 'gate', label: t('gate.modal.gate'), icon: <ShieldCheck className="h-3.5 w-3.5" aria-hidden />, status: gateStatus },
              ...(showTasks
                ? [{ id: 'tasks', label: t('gate.modal.tasks'), icon: <ListChecks className="h-3.5 w-3.5" aria-hidden />, status: tasksStatus, badge: cycle ? `${cycle.tasksDone}/${cycle.tasksTotal}` : undefined }]
                : []),
              { id: 'fixes', label: t('gate.modal.fixes'), icon: <Wrench className="h-3.5 w-3.5" aria-hidden />, status: fixesStatus, badge: fixes.length },
              { id: 'agents', label: t('gate.modal.agents'), icon: <Users className="h-3.5 w-3.5" aria-hidden />, badge: view.participants.length },
              { id: 'lastEvent', label: t('gate.modal.lastEvent'), icon: <MessageSquare className="h-3.5 w-3.5" aria-hidden /> },
            ],
          },
        ]
      : [];

  const activeId = sections[0]?.items.some((item) => item.id === selectedId) ? selectedId : 'gate';

  return (
    <SplitModal
      isOpen={open}
      onClose={onClose}
      title={t('gate.modal.title')}
      sections={sections}
      activeItemId={activeId}
      onActiveItemChange={setSelectedId}
      maxWidth="48rem"
      overlayClassName="bg-ink-950/80 backdrop-blur-md"
      closeLabel={t('gate.modal.close')}
      closeButtonProps={{ 'data-testid': 'gate-status-close' }}
      data-testid="gate-status-modal"
      className="rounded-2xl border border-foreground/15 bg-ink-950/95 text-ink-100 shadow-2xl backdrop-blur-2xl"
      bodyClassName="p-5"
    >
      {!thread || !view ? (
        <p data-testid="gate-status-no-conversation" className="text-small text-ink-300">
          {t('gate.modal.noConversation')}
        </p>
      ) : (
        <>
          {activeId === 'conversation' && (
            <Panel testId="gate-status-conversation">
              <p className="truncate text-copy font-bold text-ink-100" title={thread.title}>
                {thread.title}
              </p>
              <dl className="grid gap-0.5 text-ink-300">
                <div className="flex gap-2">
                  <dt className="text-ink-500">{t('gate.modal.agent')}</dt>
                  <dd>{agentMeta(thread.agent).name}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-ink-500">{t('gate.modal.state')}</dt>
                  <dd>{t(THREAD_STATUS_KEYS[thread.status])}</dd>
                </div>
              </dl>
              <ConversationSessionInfo sessionTitle={view.sessionTitle} engineSessionId={view.engineSessionId} provider={view.provider} />
            </Panel>
          )}

          {activeId === 'gate' && (
            <Panel testId="gate-status-gate">
              <p data-testid="gate-status-gate-label" data-gate={gate.kind} className="font-bold text-emerald-300">
                {gateLabel(gate, t)}
              </p>
              {gate.kind === 'idle' ? (
                <p className="text-ink-300">{t('gate.modal.noGate')}</p>
              ) : (
                <dl className="grid gap-0.5 text-ink-300">
                  {gate.kind === 'spec' && (
                    <>
                      <div className="flex gap-2">
                        <dt className="text-ink-500">{t('gate.modal.spec')}</dt>
                        <dd className="break-all">{gate.specId}</dd>
                      </div>
                      {gate.cycle && (
                        <div className="flex gap-2">
                          <dt className="text-ink-500">{t('gate.modal.cycle')}</dt>
                          <dd>{gate.cycle}</dd>
                        </div>
                      )}
                    </>
                  )}
                  {gate.kind === 'fix' && (
                    <div className="flex gap-2">
                      <dt className="text-ink-500">{t('gate.modal.fix')}</dt>
                      <dd className="break-all">{gate.fixId}</dd>
                    </div>
                  )}
                </dl>
              )}
            </Panel>
          )}

          {activeId === 'tasks' && (
            <Panel testId="gate-status-tasks">
              {!cycle || cycle.tasks.length === 0 ? (
                <p className="text-ink-300">{t('gate.modal.noTasks')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {cycle.tasks.map((task) => (
                    <li key={task.id} className="flex items-center gap-2">
                      <span className="shrink-0 font-mono text-ink-500">{task.id}</span>
                      <span className="min-w-0 flex-1 truncate" title={task.title}>
                        {task.title}
                      </span>
                      <span className="shrink-0 text-ink-300">{taskStatusLabel(task.status, t)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {activeId === 'fixes' && (
            <Panel testId="gate-status-fixes">
              {fixes.length === 0 ? (
                <p className="text-ink-300">{t('gate.modal.noFixes')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {fixes.map((fix) => (
                    <li key={fix.fixId} className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono" title={fix.fixId}>
                        {fix.fixId}
                      </span>
                      {fix.status && <span className="shrink-0 text-amber-300">{fix.status}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {activeId === 'agents' && (
            <Panel testId="gate-status-agents">
              {view.participants.length === 0 ? (
                <p className="text-ink-300">{t('gate.modal.noAgents')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {view.participants.map((participant) => (
                    <li key={participant.agentId} className="flex items-center justify-between gap-2">
                      <span className="truncate">{agentMeta(participant.agentId).name}</span>
                      <span className="shrink-0 text-ink-300">{t('gate.modal.events', { count: participant.events })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {activeId === 'lastEvent' && (
            <Panel testId="gate-status-last-event">
              {lastEvent ? (
                <>
                  <p className="text-ink-300">
                    {agentMeta(lastEvent.from).name}
                    {lastEvent.to ? ` → ${agentMeta(lastEvent.to).name}` : ''}
                  </p>
                  <p className="break-words text-ink-100">{clip(lastEvent.text)}</p>
                </>
              ) : (
                <p className="text-ink-300">{t('gate.modal.noEvents')}</p>
              )}
            </Panel>
          )}
        </>
      )}
    </SplitModal>
  );
}
