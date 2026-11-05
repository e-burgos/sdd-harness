'use client';

import { Button, ErrorState } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import type { WizardStepId } from '@/lib/wizard/state';
import { useRef, type ComponentType } from 'react';
import { MOTION_MIN_WIDTH } from '@/lib/motion/motion-tokens';
import { useMotionAllowed } from '@/lib/motion/use-motion-allowed';
import { DiscardChangesDialog } from './DiscardChangesDialog';
import { StepStage } from './motion/StepStage';
import { useFocusOnStepChange, useStepDirection } from './motion/use-step-focus';
import { WordTitle } from './motion/WordTitle';
import { GenerationProgress } from './GenerationProgress';
import { GenerationResult } from './GenerationResult';
import { BackStep } from './steps/BackStep';
import { ExtrasStep } from './steps/ExtrasStep';
import { FrontStep } from './steps/FrontStep';
import { ScopeStep } from './steps/ScopeStep';
import { ShapeStep } from './steps/ShapeStep';
import { SummaryStep } from './steps/SummaryStep';
import { useWizard } from './wizard-context';
import { useWizardUnavailable, WizardUnavailable } from './WizardUnavailable';
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
  const { catalogControls, step, steps, back, next, nextBlockReason, generation, positioned } = useWizard();
  const unavailable = useWizardUnavailable();
  const animate = useMotionAllowed(MOTION_MIN_WIDTH);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollerRef = useRef<HTMLElement>(null);
  const position = steps.indexOf(step);
  const direction = useStepDirection(position);
  useFocusOnStepChange(positioned ? step : null, titleRef, scrollerRef);
  if (unavailable) return <WizardUnavailable />;
  if (catalogControls.status === 'loading' || (catalogControls.status === 'ready' && !positioned)) {
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
  if (generation.target !== null) {
    const finished = generation.generation !== null && generation.generation.status !== 'running' && !generation.unknown;
    return (
      <article data-wizard-step="generation" aria-label={t('wizard.progress.title')} className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto p-6">
        {finished && generation.generation !== null ? <GenerationResult state={generation.generation} /> : <GenerationProgress />}
      </article>
    );
  }
  const Step = STEP_COMPONENT[step];
  const last = position === steps.length - 1;
  return (
    <article ref={scrollerRef} data-wizard-step={step} aria-label={stepLabel(t, step)} className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto p-6">
      <StepStage stepKey={step} direction={direction} animate={animate}>
        <header className="flex flex-col gap-1">
          <p aria-live="polite" className="font-mono text-meta uppercase tracking-[0.2em] text-accent-300">
            {t('wizard.center.stepOf', { n: position + 1, total: steps.length })}
          </p>
          <WordTitle ref={titleRef} text={stepLabel(t, step)} animate={animate} className="text-title font-semibold text-ink-50 outline-none" />
          <p className="text-copy text-ink-300">{t(`wizard.step.${step}.desc` as keyof Dict)}</p>
        </header>
        <Step />
      </StepStage>
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
