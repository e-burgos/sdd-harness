'use client';

import { Check } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import type { EntryStepId } from './entry-model';

const RAIL_TRANSITION = 'transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none';

function stepState(index: number, current: number): 'done' | 'current' | 'pending' {
  if (index < current) return 'done';
  return index === current ? 'current' : 'pending';
}

function StepMarker({ index, state }: { index: number; state: 'done' | 'current' | 'pending' }) {
  const tone =
    state === 'done'
      ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-300'
      : state === 'current'
        ? 'border-accent-400 bg-accent-dim text-accent-300 shadow-[0_0_0_4px_var(--color-accent-dim)]'
        : 'border-foreground/15 bg-ink-900/60 text-ink-500';
  return (
    <span aria-hidden className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-micro ${tone}`}>
      {state === 'done' ? <Check size={12} className="wizard-pop" /> : index + 1}
    </span>
  );
}

export function EntryProgress({ steps, current, onJump }: { steps: readonly EntryStepId[]; current: number; onJump(index: number): void }) {
  const { t } = useT();
  const ratio = steps.length > 1 ? current / (steps.length - 1) : 0;
  return (
    <nav aria-label={t('entry.progress.label')} className="flex min-w-0 flex-1 flex-col gap-2">
      <ol className="hidden items-center justify-between gap-2 md:flex">
        {steps.map((step, index) => {
          const state = stepState(index, current);
          const label = t(`entry.step.${step}` as keyof Dict);
          return (
            <li key={step} className="min-w-0">
              <button
                type="button"
                disabled={state === 'pending'}
                aria-current={state === 'current' ? 'step' : undefined}
                aria-label={state === 'done' ? `${label} (${t('entry.progress.done')})` : label}
                onClick={() => onJump(index)}
                className="group flex items-center gap-2 rounded-full py-1 pr-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:cursor-default"
              >
                <StepMarker index={index} state={state} />
                <span className={`truncate text-ui ${state === 'current' ? 'font-semibold text-ink-50' : state === 'done' ? 'text-ink-300 group-hover:text-ink-100' : 'text-ink-500'}`}>{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div aria-hidden className="relative h-px w-full bg-foreground/10">
        <div data-testid="entry-progress-fill" className={`absolute inset-0 origin-left bg-gradient-to-r from-accent-500 via-accent-400 to-emerald-400 ${RAIL_TRANSITION}`} style={{ transform: `scaleX(${ratio})` }} />
        <div className={`absolute inset-0 ${RAIL_TRANSITION}`} style={{ transform: `translateX(${ratio * 100}%)` }}>
          <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-accent-300 shadow-[0_0_12px_2px_var(--color-accent-400)]" />
        </div>
      </div>
    </nav>
  );
}
