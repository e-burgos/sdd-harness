'use client';

import type { CycleSummary } from '@sdd-studio/protocol';
import { useMemo } from 'react';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { activityOf, type ActivityEntry } from '@/lib/store/activity';
import { cycleForChannel } from '@/lib/store/selectors';
import { useStudio } from '../BridgeProvider';
import { AgentAvatar } from './AgentAvatar';
import { StatusBadge } from './StatusBadge';

const MARK: Record<string, string> = { done: '✓', 'in-progress': '▸', skipped: '–' };

export function RightPanelView({ activity, cycle, onOpenThread }: { activity: ActivityEntry[]; cycle: CycleSummary | null; onOpenThread(id: string): void }) {
  const { t } = useT();
  return (
    <aside className="flex h-full flex-col gap-6 overflow-y-auto border-l border-ink-800 bg-ink-900 p-4">
      <section>
        <h2 className="mb-2 text-[11px] uppercase tracking-wider text-ink-500">{t('panel.activity')}</h2>
        {activity.length === 0 && <p className="text-sm text-ink-300">{t('panel.noActivity')}</p>}
        <ul className="space-y-3">
          {activity.map((entry) => (
            <li key={entry.threadId} className="rounded-lg border border-ink-800 p-2">
              <button className="flex w-full items-center gap-2 rounded-md text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400" onClick={() => onOpenThread(entry.threadId)}>
                <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                <StatusBadge status={entry.status} />
              </button>
              <ul className="mt-2 space-y-1">
                {entry.agents.map((a) => (
                  <li key={a.agent} className="flex items-center gap-2 text-xs">
                    <AgentAvatar agent={a.agent} size={18} />
                    <span>{agentMeta(a.agent).name}</span>
                    {a.state === 'waiting' && <span className="text-amberish">⏸</span>}
                    {a.state === 'working' && <span className="animate-pulse text-accent-400">⟳</span>}
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
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800">
              <div className="h-full bg-accent-400" style={{ width: `${cycle.tasksTotal ? (100 * cycle.tasksDone) / cycle.tasksTotal : 0}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-300">{t('cycle.progress', { done: cycle.tasksDone, total: cycle.tasksTotal })}</p>
            {cycle.apps.length > 0 && <p className="mt-1 font-mono text-[11px] text-ink-500">{cycle.apps.join(', ')}</p>}
            <ul className="mt-3 space-y-1">
              {cycle.tasks.map((task) => (
                <li key={task.id} className="flex gap-2 text-xs">
                  <span className={task.status === 'done' ? 'text-accent-300' : task.status === 'in-progress' ? 'text-amberish' : 'text-ink-500'}>
                    {MARK[task.status] ?? '·'}
                  </span>
                  <span className="font-mono text-ink-300">{task.id}</span>
                  <span className="truncate">{task.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </aside>
  );
}

export function RightPanel({ channelId, onOpenThread }: { channelId: string; onOpenThread(id: string): void }) {
  const threads = useStudio((s) => s.threads);
  const presence = useStudio((s) => s.presence);
  const snapshot = useStudio((s) => s.snapshot);
  const activity = useMemo(() => activityOf(threads, presence), [threads, presence]);
  return <RightPanelView activity={activity} cycle={cycleForChannel(snapshot, channelId)} onOpenThread={onOpenThread} />;
}
