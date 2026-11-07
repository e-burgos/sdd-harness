'use client';

import { Check } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import type { OnboardingStatus, OnboardingStep } from '@/lib/onboarding';

const TONE: Record<OnboardingStatus, string> = {
  done: 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300',
  current: 'border-accent-400 bg-accent-400/10 text-accent-300',
  pending: 'border-ink-700 text-ink-400',
  unavailable: 'border-ink-800 text-ink-500 line-through',
};

export function OnboardingSteps({ steps, renderAction }: { steps: OnboardingStep[]; renderAction?: (step: OnboardingStep) => React.ReactNode }) {
  const { t } = useT();
  return (
    <ol aria-label={t('onboarding.list')} data-testid="onboarding-steps" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      {steps.map((step, index) => (
        <li key={step.id} data-step={step.id} data-status={step.status} aria-current={step.status === 'current' ? 'step' : undefined} className="flex items-center gap-1.5 text-small">
          <span aria-hidden className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-meta ${TONE[step.status]}`}>
            {step.status === 'done' ? <Check size={12} /> : index + 1}
          </span>
          <span className={step.status === 'current' ? 'font-medium text-ink-100' : 'text-ink-300'}>{t(`onboarding.step.${step.id}` as keyof Dict)}</span>
          <span className="sr-only">{t(`onboarding.status.${step.status}` as keyof Dict)}</span>
          {renderAction?.(step)}
        </li>
      ))}
    </ol>
  );
}
