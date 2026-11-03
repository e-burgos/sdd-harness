'use client';

import { EmptyState, StatCard } from '@e-burgos/tucu-ui';
import { Layers, ListChecks, Wrench, ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { ROW_ICON } from '@/lib/typography-tokens';
import { useStudio } from '../../BridgeProvider';
import { CLOSED_FIX_STATUSES } from '@/lib/sdd-status';
import { percentOf, planningSpecs, type PlanningCycle, type PlanningSpec } from './metrics-model';
import { ProgressBar, Section, ViewFrame, useStatusLabel } from './MetricsParts';

function CycleBlock({ entry }: { entry: PlanningCycle }) {
  const { t } = useT();
  const label = useStatusLabel();
  const { cycle } = entry;
  return (
    <div data-planning-cycle={`${cycle.specId}/${cycle.cycle}`} className="flex flex-col gap-1.5 pl-6">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-ui text-ink-100">
          {cycle.cycle} <span className="text-meta text-ink-400">· {label(cycle.status)} · {cycle.flow}</span>
        </span>
        <span className="text-meta text-ink-400">{t('metrics.plan.progress', { done: cycle.tasksDone, total: cycle.tasksTotal })}</span>
      </div>
      <ProgressBar pct={percentOf(cycle.tasksDone, cycle.tasksTotal)} label={cycle.cycle} />
      {entry.tasks.length === 0 ? (
        <p className="text-meta text-ink-400">{t('metrics.plan.noTasks')}</p>
      ) : (
        <ul className="flex flex-col">
          {entry.tasks.map((task) => (
            <li key={task.id} className="flex h-7 items-center gap-2 text-copy text-ink-100">
              <span className="w-20 shrink-0 font-mono text-meta text-ink-400">{task.id}</span>
              <span className="min-w-0 flex-1 truncate">{task.title}</span>
              {task.storyPoints !== null && <span className="shrink-0 text-meta text-ink-400">{t('metrics.plan.points.short', { n: task.storyPoints })}</span>}
              <span className="w-24 shrink-0 text-right text-meta text-ink-400">{label(task.status)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SpecBlock({ group, open, onToggle }: { group: PlanningSpec; open: boolean; onToggle: () => void }) {
  const { t } = useT();
  const label = useStatusLabel();
  const Chevron = open ? ChevronDown : ChevronRight;
  const title = group.spec?.title ?? t('metrics.plan.unknownSpec');
  return (
    <div data-planning-spec={group.specId} className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-label={t('metrics.plan.toggle', { id: group.specId })}
        onClick={onToggle}
        className="flex flex-col gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
      >
        <span className="flex items-center gap-2">
          <Chevron aria-hidden size={ROW_ICON} className="shrink-0 text-ink-400" />
          <span className="min-w-0 flex-1 truncate text-copy font-medium text-ink-50">{title}</span>
          <span className="shrink-0 text-meta text-ink-400">
            {group.spec ? `${label(group.spec.status)} · ` : ''}
            {t('metrics.plan.progress', { done: group.tasksDone, total: group.tasksTotal })} · {t('metrics.plan.points.short', { n: group.points })}
          </span>
        </span>
        <span className="pl-6">
          <ProgressBar pct={percentOf(group.tasksDone, group.tasksTotal)} label={title} />
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 pb-2">
          {group.cycles.map((entry) => (
            <CycleBlock key={entry.cycle.cycle} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PlanningView() {
  const { t } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const groups = useMemo(() => (snapshot ? planningSpecs(snapshot) : []), [snapshot]);
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  if (snapshot === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState size="sm" title={t('metrics.empty.title')} description={t('metrics.empty.body')} />
      </div>
    );
  }
  const tasksTotal = groups.reduce((sum, group) => sum + group.tasksTotal, 0);
  const tasksDone = groups.reduce((sum, group) => sum + group.tasksDone, 0);
  const points = groups.reduce((sum, group) => sum + group.points, 0);
  const pointsDone = groups.reduce((sum, group) => sum + group.cycles.reduce((inner, entry) => inner + entry.tasks.filter((task) => task.status === 'done').reduce((acc, task) => acc + (task.storyPoints ?? 0), 0), 0), 0);
  const fixesClosed = snapshot.fixes.filter((fix) => CLOSED_FIX_STATUSES.has(fix.status)).length;
  const isOpen = (group: PlanningSpec): boolean => (group.spec?.status === 'in-progress' || group.cycles.some((entry) => entry.cycle.status === 'in-progress')) !== toggled.has(group.specId);
  const toggle = (id: string) =>
    setToggled((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <ViewFrame title={t('metrics.view.planning')} description={t('metrics.plan.description')}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          title={t('metrics.plan.tasks')}
          value={`${tasksDone}/${tasksTotal}`}
          subtitle={`${percentOf(tasksDone, tasksTotal)}%`}
          icon={<ListChecks size={16} />}
          tone="success"
          progress={{ value: tasksDone, max: Math.max(tasksTotal, 1) }}
        />
        <StatCard title={t('metrics.plan.points')} value={points} subtitle={t('metrics.plan.pointsSub', { done: pointsDone })} icon={<Layers size={16} />} tone="brand" />
        <StatCard title={t('metrics.plan.fixes')} value={fixesClosed} subtitle={t('metrics.plan.fixesSub', { total: snapshot.fixes.length })} icon={<Wrench size={16} />} tone="info" />
      </div>
      <Section title={t('metrics.plan.specs')} meta={groups.length}>
        {groups.length === 0 ? (
          <p className="text-copy text-ink-400">{t('metrics.plan.noCycles')}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {groups.map((group) => (
              <SpecBlock key={group.specId} group={group} open={isOpen(group)} onToggle={() => toggle(group.specId)} />
            ))}
          </div>
        )}
      </Section>
    </ViewFrame>
  );
}
