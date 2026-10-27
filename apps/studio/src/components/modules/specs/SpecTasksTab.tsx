'use client';

import type { SpecSummary, TaskSummary } from '@sdd-studio/protocol';
import { EmptyState } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { useStudio } from '../../BridgeProvider';
import { CycleSelector, Item, Section } from './SpecParts';
import { currentCycleOf, effectiveCycle, TASK_STATUS_ORDER, taskStatusKeyOf, type TaskStatusKey } from './specs-model';

const GROUP_ORDER: readonly TaskStatusKey[] = [...TASK_STATUS_ORDER, 'other'];

export function SpecTasksTab({ spec }: { spec: SpecSummary }) {
  const { t } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const specCycle = useNav((s) => s.specCycle);
  const setSpecCycle = useNav((s) => s.setSpecCycle);
  if (!snapshot) return null;

  const shown = effectiveCycle(snapshot.cycles, spec.id, specCycle);
  if (!shown) return <EmptyState size="sm" title={t('specs.tasks.noCycle')} />;
  const current = currentCycleOf(snapshot.cycles, spec.id);

  const groups = GROUP_ORDER.map((key) => ({ key, tasks: shown.tasks.filter((task) => taskStatusKeyOf(task.status) === key) })).filter((group) => group.tasks.length > 0);
  const points = (task: TaskSummary) => (task.storyPoints == null ? t('specs.tasks.noPoints') : t('specs.tasks.points', { points: task.storyPoints }));

  return (
    <div className="flex flex-col">
      <CycleSelector cycles={snapshot.cycles} specId={spec.id} value={shown.cycle} current={current?.cycle ?? null} onChange={setSpecCycle} />
      {groups.length === 0 ? (
        <EmptyState size="sm" title={t('specs.tasks.empty')} />
      ) : (
        groups.map((group) => (
          <Section key={group.key} title={t(`specs.task.status.${group.key}`)} count={group.tasks.length}>
            {group.tasks.map((task) => (
              <Item key={task.id} label={task.title} meta={`${task.id} · ${points(task)}`} />
            ))}
          </Section>
        ))
      )}
    </div>
  );
}
