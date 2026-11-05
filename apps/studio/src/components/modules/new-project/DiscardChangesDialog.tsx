'use client';

import { ConfirmDialog } from '@e-burgos/tucu-ui';
import { useT, type TFunction } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import type { DiscardItem } from '@/lib/wizard/state';
import { useWizard } from './wizard-context';

export function discardItemText(t: TFunction, item: DiscardItem): string {
  switch (item.kind) {
    case 'app':
      return `${t('wizard.discard.app', { name: item.name, type: item.appType })}: ${t(`wizard.discard.reason.${item.reason}` as keyof Dict)}`;
    case 'lib':
      return `${t('wizard.discard.lib', { name: item.name, type: item.libType })}: ${t(`wizard.discard.reason.${item.reason}` as keyof Dict)}`;
    case 'mode':
      return `${t('wizard.discard.mode', { mode: t(`wizard.mode.${item.mode}.label` as keyof Dict) })}: ${t(`wizard.discard.reason.${item.reason}` as keyof Dict)}`;
    case 'shell-link':
      return t('wizard.discard.shellLink', { shell: item.shell, app: item.appName });
  }
}

export function DiscardChangesDialog() {
  const { t } = useT();
  const { pendingChange, confirmChange, cancelChange } = useWizard();
  return (
    <ConfirmDialog
      isOpen={pendingChange !== null}
      title={t('wizard.discard.title')}
      description={t('wizard.discard.body')}
      tone="warning"
      confirmLabel={t('wizard.discard.confirm')}
      cancelLabel={t('wizard.discard.cancel')}
      onConfirm={confirmChange}
      onCancel={cancelChange}
    >
      <ul data-testid="discard-list" className="flex list-disc flex-col gap-1 pl-5 text-small text-ink-300">
        {pendingChange?.plan.items.map((item, index) => (
          <li key={index}>{discardItemText(t, item)}</li>
        ))}
      </ul>
    </ConfirmDialog>
  );
}
