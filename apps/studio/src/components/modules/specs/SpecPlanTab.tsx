'use client';

import { EmptyState } from '@e-burgos/tucu-ui';
import { FileText } from 'lucide-react';
import type { SpecSummary } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { useStudio } from '../../BridgeProvider';
import { Chip } from '../../workspace/NavParts';
import { CycleSelector, Item, Muted } from './SpecParts';
import { effectiveCycle, planItemsOf } from './specs-model';
import { currentCycleOf } from '@/lib/sdd-status';
import { useDocumentViewer } from './use-document-viewer';

export function SpecPlanTab({ spec }: { spec: SpecSummary }) {
  const { t } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const specCycle = useNav((s) => s.specCycle);
  const setSpecCycle = useNav((s) => s.setSpecCycle);
  const { open, viewer } = useDocumentViewer();
  if (!snapshot) return null;

  const shown = effectiveCycle(snapshot.cycles, spec.id, specCycle);
  if (!shown) return <EmptyState size="sm" title={t('specs.plan.noCycle')} />;
  const current = currentCycleOf(snapshot.cycles, spec.id);
  const { items, optional } = planItemsOf(spec, shown);
  const nonePresent = items.every((item) => item.state === 'pending');
  const paths = items.filter((item) => item.state !== 'pending').map((item) => item.path);

  return (
    <div className="flex flex-col">
      <CycleSelector cycles={snapshot.cycles} specId={spec.id} value={shown.cycle} current={current?.cycle ?? null} onChange={setSpecCycle} />
      {nonePresent ? (
        <EmptyState size="sm" title={t('specs.plan.empty')} description={optional ? t('specs.plan.reducedHint') : undefined} />
      ) : (
        <div className="flex flex-col gap-0.5">
          {items.map((item) =>
            item.state === 'pending' ? (
              <Item key={item.name} mono disabled icon={FileText} label={item.name} trailing={<Chip>{t('specs.plan.pending')}</Chip>} />
            ) : (
              <Item
                key={item.name}
                mono
                icon={FileText}
                label={item.name}
                ariaLabel={t('specs.plan.open', { name: item.name })}
                trailing={<Chip tone={item.state === 'present' ? 'success' : 'neutral'}>{t(item.state === 'present' ? 'specs.plan.present' : 'specs.plan.unknown')}</Chip>}
                onClick={() => open(item.path, paths)}
              />
            ),
          )}
          {optional && <Muted>{t('specs.plan.reducedHint')}</Muted>}
        </div>
      )}
      {viewer}
    </div>
  );
}
