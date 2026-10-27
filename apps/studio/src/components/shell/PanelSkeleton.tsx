'use client';

import { Skeleton } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';

export function PanelSkeleton({ rows = 6 }: { rows?: number }) {
  const { t } = useT();
  return (
    <div role="status" aria-label={t('shell.panel.loading')} className="flex flex-col gap-2 px-2 py-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height="1.25rem" />
      ))}
    </div>
  );
}
