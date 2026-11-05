'use client';

import { Button, ConfirmDialog } from '@e-burgos/tucu-ui';
import { Check, Circle, CircleDot, Minus, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { isInitialState, WIZARD_STEPS } from '@/lib/wizard/state';
import { ModulePanel } from '../../shell/ModulePanel';
import { PanelRow } from '../../shell/PanelRow';
import { useWizard, type StepState } from './wizard-context';
import { useWizardUnavailable, WizardUnavailable } from './WizardUnavailable';
import { stepLabel } from './wizard-text';

const STEP_ICON = { current: CircleDot, done: Check, pending: Circle, na: Minus } as const;

const DOT_TONE = {
  current: 'wizard-breathe text-accent-400 shadow-[0_0_0_3px_var(--color-accent-dim),0_0_14px_2px_var(--color-accent-dim)]',
  done: 'wizard-pop text-accent-400',
  pending: 'text-ink-400',
  na: 'text-ink-500',
} as const;

function StepDot({ state }: { state: StepState }) {
  const Icon = STEP_ICON[state];
  return (
    <span data-step-dot={state} className={`relative z-10 flex shrink-0 rounded-full bg-ink-900 ${DOT_TONE[state]}`}>
      <Icon aria-hidden size={16} />
    </span>
  );
}

function ProgressRail({ progress }: { progress: number }) {
  return (
    <span aria-hidden className="pointer-events-none absolute bottom-[14px] left-[15.5px] top-[14px] w-px bg-foreground/10">
      <span
        data-testid="wizard-progress-fill"
        className="absolute inset-0 origin-top bg-gradient-to-b from-accent-300 to-accent-400 shadow-[0_0_8px_var(--color-accent-400)] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        style={{ transform: `scaleY(${progress})` }}
      />
    </span>
  );
}

function StepRow({ id, index, state }: { id: (typeof WIZARD_STEPS)[number]; index: number; state: StepState }) {
  const { t } = useT();
  const { goToStep } = useWizard();
  const name = stepLabel(t, id);
  const stateText = t(`wizard.step.state.${state}` as keyof Dict);
  return (
    <li data-step={id} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
      <PanelRow
        leading={<StepDot key={state} state={state} />}
        label={name}
        meta={state === 'na' ? t('wizard.step.state.na') : undefined}
        title={state === 'na' ? t('wizard.step.state.na') : name}
        ariaLabel={t('wizard.step.row', { n: index + 1, name, state: stateText })}
        selected={state === 'current'}
        onClick={state === 'na' ? undefined : () => goToStep(id)}
      />
    </li>
  );
}

function RestartButton() {
  const { t } = useT();
  const { state, restart } = useWizard();
  const [confirming, setConfirming] = useState(false);
  const ask = () => (isInitialState(state) ? restart() : setConfirming(true));
  return (
    <>
      <Button type="button" size="tiny" variant="transparent" color="gray" className="mx-2 mt-2 justify-start text-ui" onClick={ask}>
        <RotateCcw aria-hidden size={14} className="mr-1" />
        {t('wizard.panel.restart')}
      </Button>
      <ConfirmDialog
        isOpen={confirming}
        title={t('wizard.restart.title')}
        description={t('wizard.restart.body')}
        tone="warning"
        confirmLabel={t('wizard.restart.confirm')}
        cancelLabel={t('wizard.restart.cancel')}
        onConfirm={() => {
          setConfirming(false);
          restart();
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

export function NewProjectPanel() {
  const { t } = useT();
  const { catalogControls, stepState, step } = useWizard();
  const progress = WIZARD_STEPS.indexOf(step) / (WIZARD_STEPS.length - 1);
  const unavailable = useWizardUnavailable();
  const status = catalogControls.status === 'ready' ? 'ready' : catalogControls.status === 'error' ? 'error' : 'loading';
  return (
    <ModulePanel moduleId="new-project" searchable={false} status={unavailable ? 'ready' : status} onRetry={catalogControls.reload}>
      {unavailable ? (
        <WizardUnavailable />
      ) : (
        <>
      <div className="relative">
        <ProgressRail progress={progress} />
        <ol aria-label={t('wizard.panel.steps')} className="relative flex flex-col gap-px">
          {WIZARD_STEPS.map((id, index) => (
            <StepRow key={id} id={id} index={index} state={stepState(id)} />
          ))}
        </ol>
      </div>
      <RestartButton />
        </>
      )}
    </ModulePanel>
  );
}
