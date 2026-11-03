'use client';

import { EmptyState } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';
import { FixCard } from './FixCard';
import { useFixes } from './use-fixes';

export function FixesCenter() {
  const { t } = useT();
  const { snapshot, fixes, selectedId, selected } = useFixes();
  if (snapshot === null) return null;
  if (selected !== null) return <FixCard key={selected.id} fix={selected} />;
  const state =
    fixes.length === 0
      ? { title: t('fixes.center.emptyTitle'), description: t('fixes.center.emptyBody') }
      : selectedId !== null
        ? { title: t('fixes.center.missingTitle'), description: t('fixes.center.missingBody', { id: selectedId }) }
        : { title: t('fixes.center.pickTitle'), description: t('fixes.center.pickBody') };
  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState size="sm" {...state} />
    </div>
  );
}
