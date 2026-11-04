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
import { stepLabel } from './wizard-text';

const STEP_ICON = { current: CircleDot, done: Check, pending: Circle, na: Minus } as const;

function StepRow({ id, index, state }: { id: (typeof WIZARD_STEPS)[number]; index: number; state: StepState }) {
  const { t } = useT();
  const { goToStep } = useWizard();
  const name = stepLabel(t, id);
  const stateText = t(`wizard.step.state.${state}` as keyof Dict);
  return (
    <li data-step={id} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
      <PanelRow
        icon={STEP_ICON[state]}
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
  const { catalogControls, stepState } = useWizard();
  const status = catalogControls.status === 'ready' ? 'ready' : catalogControls.status === 'error' ? 'error' : 'loading';
  return (
    <ModulePanel moduleId="new-project" searchable={false} status={status} onRetry={catalogControls.reload}>
      <ol aria-label={t('wizard.panel.steps')} className="flex flex-col gap-px">
        {WIZARD_STEPS.map((id, index) => (
          <StepRow key={id} id={id} index={index} state={stepState(id)} />
        ))}
      </ol>
      <RestartButton />
    </ModulePanel>
  );
}
