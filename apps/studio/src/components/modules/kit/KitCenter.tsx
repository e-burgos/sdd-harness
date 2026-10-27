'use client';

import { EmptyState } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';

export function KitCenter() {
  const { t } = useT();
  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState size="sm" title={t('shell.stub.title')} />
    </div>
  );
}
