'use client';

import type { TaskSummary } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { usageChipText } from '@/lib/kit-execution';
import { Item, StatusBadge } from './SpecParts';
import { taskStatusKeyOf } from './specs-model';

export function TaskRow({ task, points, showStatus = false }: { task: TaskSummary; points: string; showStatus?: boolean }) {
  const { t, lang } = useT();
  const chip = task.usage ? usageChipText(task.usage, lang) : null;
  const statusKey = taskStatusKeyOf(task.status);
  const trailing =
    chip || showStatus ? (
      <span className="flex shrink-0 items-center gap-1.5">
        {chip && (
          <span data-testid="usage-chip" title={t('specs.tasks.usageTitle', { detail: chip })} className="rounded-full border border-foreground/10 bg-foreground/5 px-2 font-mono text-micro text-ink-300">
            {chip}
          </span>
        )}
        {showStatus && <StatusBadge status={task.status} label={t(`specs.task.status.${statusKey}`)} />}
      </span>
    ) : undefined;
  return <Item label={task.title} meta={`${task.id} · ${points}`} trailing={trailing} />;
}
