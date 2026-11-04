'use client';

import { Button, ErrorState } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import type { WizardStepId } from '@/lib/wizard/state';
import type { ComponentType } from 'react';
import { DiscardChangesDialog } from './DiscardChangesDialog';
import { BackStep } from './steps/BackStep';
import { ExtrasStep } from './steps/ExtrasStep';
import { FrontStep } from './steps/FrontStep';
import { ScopeStep } from './steps/ScopeStep';
import { ShapeStep } from './steps/ShapeStep';
import { SummaryStep } from './steps/SummaryStep';
import { useWizard } from './wizard-context';
import { stepLabel } from './wizard-text';

const STEP_COMPONENT: Record<WizardStepId, ComponentType> = {
  scope: ScopeStep,
  shape: ShapeStep,
  front: FrontStep,
  back: BackStep,
  extras: ExtrasStep,
  summary: SummaryStep,
};

export function NewProjectCenter() {
  const { t } = useT();
  const { catalogControls, step, steps, back, next, nextBlockReason } = useWizard();
  if (catalogControls.status === 'loading') {
    return (
      <p role="status" className="p-6 text-copy text-ink-400">
        {t('wizard.center.catalogLoading')}
      </p>
    );
  }
  if (catalogControls.status === 'error') {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <ErrorState
          size="sm"
          title={t('wizard.center.catalogError', { error: catalogControls.error ?? '' })}
          action={
            <Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" onClick={catalogControls.reload}>
              {t('wizard.center.retry')}
            </Button>
          }
        />
      </div>
    );
  }
  const Step = STEP_COMPONENT[step];
  const position = steps.indexOf(step);
  const last = position === steps.length - 1;
  return (
    <article data-wizard-step={step} aria-label={stepLabel(t, step)} className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto p-6">
      <header className="flex flex-col gap-1">
        <p className="text-meta text-ink-400">{t('wizard.center.stepOf', { n: position + 1, total: steps.length })}</p>
        <h1 className="text-title font-semibold text-ink-50">{stepLabel(t, step)}</h1>
        <p className="text-copy text-ink-300">{t(`wizard.step.${step}.desc` as keyof Dict)}</p>
      </header>
      <Step />
      <footer className="mt-auto flex flex-col gap-2 border-t border-foreground/10 pt-4">
        {!last && nextBlockReason !== null && (
          <p data-testid="next-blocked-reason" role="status" className="text-small text-amberish">
            {t('wizard.center.blocked', { reason: nextBlockReason })}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" disabled={position <= 0} onClick={back}>
            {t('wizard.center.back')}
          </Button>
          {!last && (
            <Button type="button" size="tiny" className="text-ui" disabled={nextBlockReason !== null} onClick={next}>
              {t('wizard.center.next')}
            </Button>
          )}
        </div>
      </footer>
      <DiscardChangesDialog />
    </article>
  );
}
