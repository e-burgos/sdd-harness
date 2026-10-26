'use client';

import type { CycleSummary } from '@sdd-studio/protocol';
import { useMemo } from 'react';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { activityOf, type ActivityEntry } from '@/lib/store/activity';
import { cycleForChannel } from '@/lib/store/selectors';
import { useStudio } from '../BridgeProvider';
import { Check, Loader2, Minus, Pause, Play } from 'lucide-react';
import { AgentAvatar } from './AgentAvatar';
import { PanelToggle } from './PanelRail';
import { StatusBadge } from './StatusBadge';

function TaskStatusIcon({ status }: { status: string }) {
  if (status === 'done') return <Check size={12} className="shrink-0" data-testid="task-icon-done" aria-hidden />;
  if (status === 'in-progress') return <Play size={10} className="shrink-0 fill-current" data-testid="task-icon-in-progress" aria-hidden />;
  if (status === 'skipped') return <Minus size={12} className="shrink-0" data-testid="task-icon-skipped" aria-hidden />;
  return <span aria-hidden>·</span>;
}

const TASK_KEYS = { done: 'task.done', 'in-progress': 'task.in-progress', skipped: 'task.skipped', pending: 'task.pending' } as const;
const PRESENCE_KEYS = { working: 'presence.working', waiting: 'presence.waiting', open: 'presence.open', idle: 'presence.idle' } as const;

export function RightPanelView({ activity, cycle, onOpenThread, onCollapse }: { activity: ActivityEntry[]; cycle: CycleSummary | null; onOpenThread(id: string): void; onCollapse?(): void }) {
  const { t } = useT();
  return (
    <aside aria-label={t('panel.label')} className="flex h-full flex-col gap-6 overflow-y-auto overscroll-contain border-l border-ink-800 bg-ink-900 p-4">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] uppercase tracking-wider text-ink-500">{t('panel.activity')}</h2>
          {onCollapse && <PanelToggle label={t('panel.right.collapse')} side="right" onClick={onCollapse} />}
        </div>
        {activity.length === 0 && <p className="text-sm text-ink-300">{t('panel.noActivity')}</p>}
        <ul className="space-y-3">
          {activity.map((entry) => (
            <li key={entry.threadId} className="rounded-lg border border-ink-800 p-2">
              <button className="flex w-full items-center gap-2 rounded-md text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400" onClick={() => onOpenThread(entry.threadId)}>
                <span className="min-w-0 flex-1 truncate" title={entry.title}>{entry.title}</span>
                <StatusBadge status={entry.status} />
              </button>
              <ul className="mt-2 space-y-1">
                {entry.agents.map((a) => (
                  <li key={a.agent} className="flex items-center gap-2 text-xs">
                    <AgentAvatar agent={a.agent} size={22} status={a.state === 'working' ? 'running' : a.state === 'waiting' ? 'waiting-approval' : null} />
                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className="font-medium">{agentMeta(a.agent).name}</span>
                      <span className="text-[10px] text-ink-400 font-mono">{agentMeta(a.agent).role}</span>
                    </div>
                    {a.state === 'waiting' && (
                      <span className="text-amberish">
                        <Pause size={12} className="inline-block" aria-hidden />
                        <span className="sr-only">{t(PRESENCE_KEYS.waiting)}</span>
                      </span>
                    )}
                    {a.state === 'working' && (
                      <span className="text-accent-400">
                        <Loader2 size={12} className="inline-block motion-safe:animate-spin" aria-hidden />
                        <span className="sr-only">{t(PRESENCE_KEYS.working)}</span>
                      </span>
                    )}
                    {a.tool && <span className="ml-auto font-mono text-ink-300">{a.tool}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-[11px] uppercase tracking-wider text-ink-500">{t('panel.details')}</h2>
        {!cycle ? (
          <p className="text-sm text-ink-300">{t('panel.noCycle')}</p>
        ) : (
          <div className="rounded-lg border border-ink-800 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{cycle.cycle}</span>
              <span className="text-xs text-ink-300">{cycle.flow} · {cycle.status}</span>
            </div>
            <div
              role="progressbar"
              aria-label={t('panel.details')}
              aria-valuemin={0}
              aria-valuemax={cycle.tasksTotal}
              aria-valuenow={cycle.tasksDone}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800"
            >
              <div className="h-full bg-accent-400" style={{ width: `${cycle.tasksTotal ? (100 * cycle.tasksDone) / cycle.tasksTotal : 0}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-300">{t('cycle.progress', { done: cycle.tasksDone, total: cycle.tasksTotal })}</p>
            {cycle.apps.length > 0 && <p className="mt-1 font-mono text-[11px] text-ink-500">{cycle.apps.join(', ')}</p>}
            <ul className="mt-3 space-y-1">
              {cycle.tasks.map((task) => (
                <li key={task.id} className="flex gap-2 text-xs">
                  <span className={task.status === 'done' ? 'text-accent-300' : task.status === 'in-progress' ? 'text-amberish' : 'text-ink-500'}>
                    <TaskStatusIcon status={task.status} />
                    <span className="sr-only">{task.status in TASK_KEYS ? t(TASK_KEYS[task.status as keyof typeof TASK_KEYS]) : task.status}</span>
                  </span>
                  <span className="font-mono text-ink-300">{task.id}</span>
                  <span className="truncate" title={task.title}>{task.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </aside>
  );
}

export function RightPanel({ channelId, onOpenThread, onCollapse }: { channelId: string; onOpenThread(id: string): void; onCollapse?(): void }) {
  const threads = useStudio((s) => s.threads);
  const presence = useStudio((s) => s.presence);
  const snapshot = useStudio((s) => s.snapshot);
  const activity = useMemo(() => activityOf(threads, presence), [threads, presence]);
  return <RightPanelView activity={activity} cycle={cycleForChannel(snapshot, channelId)} onOpenThread={onOpenThread} onCollapse={onCollapse} />;
}
