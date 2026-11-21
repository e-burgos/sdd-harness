'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import type { TaskSummary } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { blockHasApprox, blockTokens, compactTokens, type TaskBlock } from '@/lib/kit-execution';
import { PANEL_TYPE, ROW_HEIGHT } from '@/lib/typography-tokens';
import type { CollapsedState } from '@/lib/use-collapsed-state';
import { focusRing } from '../../shell/shell-context';
import { TaskRow } from './TaskRow';
import { taskStatusKeyOf } from './specs-model';

export function TaskBlockGroup({ block, nodeId, collapse, points }: { block: TaskBlock; nodeId: string; collapse: CollapsedState; points: (task: TaskSummary) => string }) {
  const { t, lang } = useT();
  const collapsed = collapse.isCollapsed(nodeId, false);
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  const done = block.tasks.filter((task) => taskStatusKeyOf(task.status) === 'done').length;
  const tokens = blockTokens(block.tasks);
  const heading = block.batch ? `${block.batch.id} · ${block.batch.app} · ${block.batch.role}` : t('specs.tasks.blockLoose');
  return (
    <section data-task-block={block.batch?.id ?? 'loose'} className="flex flex-col border-t border-foreground/10 py-1 first:border-t-0">
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-label={t('specs.tasks.blockToggle', { id: block.batch?.id ?? t('specs.tasks.blockLoose') })}
        onClick={() => collapse.toggle(nodeId, false)}
        className={`${focusRing} flex ${ROW_HEIGHT} w-full items-center gap-1 rounded-md px-2 text-left hover:bg-ink-800 ${PANEL_TYPE.group}`}
      >
        <Chevron aria-hidden size={14} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{heading}</span>
        <span data-testid="block-progress" className={`${PANEL_TYPE.meta} shrink-0 font-normal`}>{t('specs.tasks.blockProgress', { done, total: block.tasks.length })}</span>
        {tokens > 0 && (
          <span data-testid="block-tokens" className={`${PANEL_TYPE.meta} shrink-0 font-normal`}>
            {t('specs.tasks.tokens', { tokens: `${blockHasApprox(block.tasks) ? '≈' : ''}${compactTokens(tokens, lang)}` })}
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="flex flex-col gap-px">
          {block.tasks.map((task) => (
            <TaskRow key={task.id} task={task} points={points(task)} showStatus />
          ))}
        </div>
      )}
    </section>
  );
}
