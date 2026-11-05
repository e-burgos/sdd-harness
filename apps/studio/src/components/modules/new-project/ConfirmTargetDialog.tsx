'use client';

import { ConfirmDialog } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';
import type { PendingConfirmation } from '@/lib/wizard/use-launch';

export interface ConfirmTargetDialogProps {
  confirmation: PendingConfirmation | null;
  loading: boolean;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmTargetDialog({ confirmation, loading, onConfirm, onCancel }: ConfirmTargetDialogProps) {
  const { t } = useT();
  const check = confirmation?.check ?? null;
  const entries = check?.entries ?? null;
  return (
    <ConfirmDialog
      isOpen={confirmation !== null}
      title={t('wizard.confirmTarget.title')}
      description={check === null ? undefined : t('wizard.confirmTarget.path', { path: check.resolvedPath ?? check.input })}
      tone="warning"
      initialFocus="cancel"
      loading={loading}
      confirmLabel={t('wizard.confirmTarget.confirm')}
      cancelLabel={t('wizard.confirmTarget.cancel')}
      onConfirm={onConfirm}
      onCancel={onCancel}
      data-testid="confirm-target"
    >
      <div className="flex flex-col gap-2 text-small text-ink-300">
        {confirmation?.changed && (
          <p role="alert" className="text-amberish">
            {t('wizard.confirmTarget.changed')}
          </p>
        )}
        {entries !== null && <p>{t('wizard.confirmTarget.count', { count: entries.count })}</p>}
        {entries !== null && entries.sample.length > 0 && (
          <>
            <p>{t('wizard.confirmTarget.first')}</p>
            <ul data-testid="confirm-sample" className="list-disc pl-5 text-ink-100">
              {entries.sample.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </>
        )}
        {entries?.notable.includes('.git') && <p className="text-amberish">{t('wizard.confirmTarget.warn.git')}</p>}
        {entries?.notable.includes('harness.config.json') && <p className="text-amberish">{t('wizard.confirmTarget.warn.config')}</p>}
        {check?.insideProject && <p className="text-amberish">{t('wizard.confirmTarget.insideProject')}</p>}
      </div>
    </ConfirmDialog>
  );
}
