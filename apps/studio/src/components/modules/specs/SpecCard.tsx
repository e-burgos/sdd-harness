'use client';

import { AnimatedTabs } from '@e-burgos/tucu-ui';
import type { SpecSummary } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { useNav, SPEC_TABS, type SpecTab } from '@/lib/nav/use-nav';
import { useStudio } from '../../BridgeProvider';
import { ModuleBoundary } from '../../shell/ModuleBoundary';
import { Chip } from '../../workspace/NavParts';
import { SpecConversationsTab } from './SpecConversationsTab';
import { SpecDocumentsTab } from './SpecDocumentsTab';
import { StatusBadge } from './SpecParts';
import { SpecPlanTab } from './SpecPlanTab';
import { SpecSummaryTab } from './SpecSummaryTab';
import { SpecTasksTab } from './SpecTasksTab';
import { currentCycleOf } from '@/lib/sdd-status';

const TAB_VIEW: Record<SpecTab, (props: { spec: SpecSummary }) => React.JSX.Element | null> = {
  summary: SpecSummaryTab,
  plan: SpecPlanTab,
  tasks: SpecTasksTab,
  documents: SpecDocumentsTab,
  conversations: SpecConversationsTab,
};

export function statusLabelOf(t: ReturnType<typeof useT>['t'], status: string): string {
  const key = `specs.status.${status}`;
  const label = t(key as Parameters<typeof t>[0]);
  return label === key ? status : label;
}

export function SpecCard({ spec }: { spec: SpecSummary }) {
  const { t } = useT();
  const cycles = useStudio((s) => s.snapshot?.cycles ?? []);
  const tab = useNav((s) => s.specTab);
  const setSpecTab = useNav((s) => s.setSpecTab);
  const current = currentCycleOf(cycles, spec.id);
  const View = TAB_VIEW[tab];

  return (
    <article data-testid="spec-card" aria-label={spec.title} className="flex h-full min-h-0 min-w-0 flex-col bg-ink-950">
      <header className="flex shrink-0 flex-col gap-2 border-b border-foreground/10 px-4 pb-0 pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="min-w-0 truncate text-title font-semibold">{spec.title}</h2>
          <StatusBadge status={spec.status} label={statusLabelOf(t, spec.status)} />
          {current && (
            <span className="flex items-center gap-1.5 text-meta text-ink-400">
              {t('specs.card.currentCycle')}
              <Chip>{`${current.cycle} · ${current.flow}`}</Chip>
            </span>
          )}
        </div>
        <p className="truncate font-mono text-meta text-ink-400">{spec.id}</p>
        <AnimatedTabs<SpecTab>
          size="sm"
          mobile="scroll"
          activeTab={tab}
          onChange={setSpecTab}
          tabs={SPEC_TABS.map((id) => ({ id, label: <span className="text-ui">{t(`specs.tab.${id}`)}</span> }))}
        />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <ModuleBoundary resetKey={`${spec.id}:${tab}`}>
          <View spec={spec} />
        </ModuleBoundary>
      </div>
    </article>
  );
}
