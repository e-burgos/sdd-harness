'use client';

import { EmptyState, StatCard } from '@e-burgos/tucu-ui';
import { CircleDot, GitBranch, ListChecks, Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { useStudio } from '../../BridgeProvider';
import { dashboardStats, percentOf, type StatusCount } from './metrics-model';
import { Section, ShareRow, ViewFrame, useStatusLabel } from './MetricsParts';

function Breakdown({ title, rows, total, empty }: { title: string; rows: StatusCount[]; total: number; empty: string }) {
  const label = useStatusLabel();
  return (
    <Section title={title} meta={total}>
      {rows.length === 0 ? (
        <p className="text-copy text-ink-400">{empty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <ShareRow key={row.status} label={label(row.status)} value={row.count} pct={percentOf(row.count, total)} />
          ))}
        </div>
      )}
    </Section>
  );
}

export function MetricsDashboard() {
  const { t } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const stats = useMemo(() => (snapshot ? dashboardStats(snapshot) : null), [snapshot]);
  if (stats === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState size="sm" title={t('metrics.empty.title')} description={t('metrics.empty.body')} />
      </div>
    );
  }
  const specsActive = stats.specsByStatus.find((row) => row.status === 'in-progress')?.count ?? 0;
  return (
    <ViewFrame title={t('metrics.view.dashboard')} description={t('metrics.dash.description')}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={t('metrics.dash.specs')} value={stats.specsTotal} subtitle={t('metrics.dash.specsSub', { n: specsActive })} icon={<GitBranch size={16} />} tone="brand" />
        <StatCard title={t('metrics.dash.cycles')} value={stats.cyclesTotal} subtitle={t('metrics.dash.cyclesSub', { n: stats.cyclesInProgress })} icon={<CircleDot size={16} />} tone="info" />
        <StatCard
          title={t('metrics.dash.tasks')}
          value={`${percentOf(stats.tasksDone, stats.tasksTotal)}%`}
          subtitle={t('metrics.dash.tasksSub', { done: stats.tasksDone, total: stats.tasksTotal })}
          icon={<ListChecks size={16} />}
          tone="success"
          progress={{ value: stats.tasksDone, max: Math.max(stats.tasksTotal, 1) }}
        />
        <StatCard title={t('metrics.dash.fixes')} value={stats.fixesOpen} subtitle={t('metrics.dash.fixesSub', { n: stats.fixesTotal })} icon={<Wrench size={16} />} tone={stats.fixesOpen > 0 ? 'warning' : 'neutral'} />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Breakdown title={t('metrics.dash.specsByStatus')} rows={stats.specsByStatus} total={stats.specsTotal} empty={t('metrics.dash.noneSpecs')} />
        <Breakdown title={t('metrics.dash.fixesByStatus')} rows={stats.fixesByStatus} total={stats.fixesTotal} empty={t('metrics.dash.noneFixes')} />
      </div>
    </ViewFrame>
  );
}
