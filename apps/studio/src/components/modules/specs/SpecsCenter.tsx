'use client';

import { EmptyState } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { useStudio } from '../../BridgeProvider';
import { SpecCard } from './SpecCard';

export function SpecsCenter() {
  const { t } = useT();
  const selected = useNav((s) => s.selection.specs);
  const spec = useStudio((s) => (selected ? (s.snapshot?.specs.find((item) => item.id === selected) ?? null) : null));

  if (!selected) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState size="sm" title={t('specs.select')} />
      </div>
    );
  }
  if (!spec) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState size="sm" title={t('specs.missing')} />
      </div>
    );
  }
  return <SpecCard spec={spec} />;
}
