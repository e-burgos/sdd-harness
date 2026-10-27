'use client';

import { useMemo } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { PANEL_TYPE } from '@/lib/typography-tokens';
import { useStudio } from '../../BridgeProvider';
import { Chip, CycleTrail } from '../../workspace/NavParts';
import { CenterHeader } from './ChannelCenter';
import { SectionTitle, ThreadRows } from './channel-sections';
import { approvalThreads, runningCycles, runningThreads } from './derive';

export function InboxCenter({ which, onOpenThread }: { which: 'running' | 'approvals'; onOpenThread(id: string): void }) {
  const { t } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const threads = useStudio((s) => s.threads);
  const open = useNav((s) => s.open);
  const list = useMemo(() => (which === 'running' ? runningThreads(threads) : approvalThreads(threads)), [which, threads]);
  const cycles = useMemo(() => (which === 'running' ? runningCycles(snapshot) : []), [which, snapshot]);
  const title = t(which === 'running' ? 'home.title.running' : 'home.title.approvals');
  const empty = t(which === 'running' ? 'home.inbox.noRunning' : 'home.inbox.noApprovals');
  return (
    <section aria-label={title} className="flex h-full min-w-0 flex-col">
      <CenterHeader title={title} />
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-4">
        <section aria-label={t('home.threads')}>
          <SectionTitle>{t('home.threads')}</SectionTitle>
          <ThreadRows threads={list} onOpen={onOpenThread} emptyText={empty} />
        </section>
        {cycles.length > 0 && (
          <section aria-label={t('home.inbox.cycles')}>
            <SectionTitle>{t('home.inbox.cycles')}</SectionTitle>
            <ul className="space-y-1.5">
              {cycles.map((cycle) => (
                <li key={`${cycle.specId}/${cycle.cycle}`}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg border border-foreground/10 bg-ink-900 px-3 py-2 text-left hover:border-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
                    onClick={() => open('specs', cycle.specId)}
                  >
                    <span className={`${PANEL_TYPE.item} min-w-0 flex-1 truncate`}>{cycle.specId}</span>
                    <Chip tone="info">{cycle.cycle}</Chip>
                    <CycleTrail progress={{ cycle: cycle.cycle, flow: cycle.flow, done: cycle.tasksDone, total: cycle.tasksTotal }} withCycle={false} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </section>
  );
}
