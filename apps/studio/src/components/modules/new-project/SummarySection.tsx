'use client';

import { Button } from '@e-burgos/tucu-ui';
import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n/i18n';
import type { WizardStepId } from '@/lib/wizard/state';
import { useWizard } from './wizard-context';

export function SummarySection({ id, title, editStep, children }: { id: string; title: string; editStep?: WizardStepId; children: ReactNode }) {
  const { t } = useT();
  const { editStep: edit } = useWizard();
  return (
    <section data-summary-section={id} aria-label={title} className="flex flex-col gap-2 border-t border-foreground/10 pt-4 first:border-t-0 first:pt-0">
      <header className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 text-copy font-medium text-ink-50">{title}</h3>
        {editStep && (
          <Button type="button" size="tiny" variant="transparent" color="gray" className="text-ui" aria-label={t('wizard.summary.editSection', { section: title })} onClick={() => edit(editStep)}>
            {t('wizard.summary.edit')}
          </Button>
        )}
      </header>
      {children}
    </section>
  );
}
