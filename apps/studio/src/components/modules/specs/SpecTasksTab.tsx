'use client';

import type { SpecSummary, TaskSummary } from '@sdd-studio/protocol';
import { EmptyState } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { useStudio } from '../../BridgeProvider';
import { CycleSelector, Section } from './SpecParts';
import { effectiveCycle, TASK_STATUS_ORDER, taskStatusKeyOf, type TaskStatusKey } from './specs-model';
import { currentCycleOf } from '@/lib/sdd-status';
import { groupTasksByBatch } from '@/lib/kit-execution';
import { useCollapsedState } from '@/lib/use-collapsed-state';
import { TaskBlockGroup } from './TaskBlockGroup';
import { TaskRow } from './TaskRow';

const GROUP_ORDER: readonly TaskStatusKey[] = [...TASK_STATUS_ORDER, 'other'];

export function SpecTasksTab({ spec }: { spec: SpecSummary }) {
  const { t } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const collapse = useCollapsedState(snapshot?.project ?? '');
  const specCycle = useNav((s) => s.specCycle);
  const setSpecCycle = useNav((s) => s.setSpecCycle);
  if (!snapshot) return null;

  const shown = effectiveCycle(snapshot.cycles, spec.id, specCycle);
  if (!shown) return <EmptyState size="sm" title={t('specs.tasks.noCycle')} />;
  const current = currentCycleOf(snapshot.cycles, spec.id);

  const groups = GROUP_ORDER.map((key) => ({ key, tasks: shown.tasks.filter((task) => taskStatusKeyOf(task.status) === key) })).filter((group) => group.tasks.length > 0);
  const points = (task: TaskSummary) => (task.storyPoints == null ? t('specs.tasks.noPoints') : t('specs.tasks.points', { points: task.storyPoints }));

  const blocks = shown.batches && shown.batches.length > 0 ? groupTasksByBatch(shown.tasks, shown.batches) : null;

  return (
    <div className="flex flex-col">
      <CycleSelector cycles={snapshot.cycles} specId={spec.id} value={shown.cycle} current={current?.cycle ?? null} onChange={setSpecCycle} />
      {blocks ? (
        blocks.map((block) => (
          <TaskBlockGroup key={block.batch?.id ?? 'loose'} block={block} nodeId={`specs:blocks:${spec.id}:${shown.cycle}:${block.batch?.id ?? 'loose'}`} collapse={collapse} points={points} />
        ))
      ) : groups.length === 0 ? (
        <EmptyState size="sm" title={t('specs.tasks.empty')} />
      ) : (
        groups.map((group) => (
          <Section key={group.key} title={t(`specs.task.status.${group.key}`)} count={group.tasks.length}>
            {group.tasks.map((task) => (
              <TaskRow key={task.id} task={task} points={points(task)} />
            ))}
          </Section>
        ))
      )}
    </div>
  );
}
