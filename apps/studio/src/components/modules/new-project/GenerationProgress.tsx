'use client';

import { Alert, Button, ConfirmDialog } from '@e-burgos/tucu-ui';
import { Check, Circle, CircleAlert, LoaderCircle, Minus } from 'lucide-react';
import { useState } from 'react';
import type { GenerationStage, GenerationState } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { ROW_ICON } from '@/lib/typography-tokens';
import { CopyButton } from './CopyButton';
import { OutputLog } from './OutputLog';
import { useWizard } from './wizard-context';

type StageStatus = GenerationState['stages'][number]['status'];

const STAGE_ICON: Record<StageStatus, typeof Check> = { pending: Circle, active: LoaderCircle, done: Check, failed: CircleAlert, skipped: Minus };
const STAGE_CLASS: Record<StageStatus, string> = {
  pending: 'text-ink-500',
  active: 'text-accent-400',
  done: 'text-emerald-400',
  failed: 'text-roseish',
  skipped: 'text-ink-500',
};

export function StageList({ stages }: { stages: GenerationState['stages'] }) {
  const { t } = useT();
  return (
    <ol aria-label={t('wizard.progress.stages')} className="flex flex-col gap-1">
      {stages.map(({ stage, status }) => {
        const Icon = STAGE_ICON[status];
        return (
          <li key={stage} data-stage={stage} data-status={status} aria-current={status === 'active' ? 'step' : undefined} className={`flex items-center gap-2 text-copy ${STAGE_CLASS[status]}`}>
            <Icon aria-hidden size={ROW_ICON} className={status === 'active' ? 'animate-spin' : undefined} />
            <span className={status === 'active' ? 'font-medium text-ink-50' : undefined}>{t(`wizard.progress.stage.${stage satisfies GenerationStage}` as keyof Dict)}</span>
            <span className="text-meta text-ink-400">{t(`wizard.progress.stageState.${status}` as keyof Dict)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function UnknownGeneration() {
  const { t } = useT();
  const { generation, setTargetPath, goToStep } = useWizard();
  const target = generation.target ?? '';
  const reviewFolder = () => {
    setTargetPath(target);
    generation.dismiss();
    goToStep('summary');
  };
  return (
    <div data-testid="generation-unknown" className="flex flex-col gap-3">
      <Alert variant="warning" density="compact" live="polite">
        <strong>{t('wizard.progress.unknown.title')}</strong>
        <span className="block">{t('wizard.progress.unknown.body', { path: target })}</span>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="tiny" className="text-ui" onClick={reviewFolder}>
          {t('wizard.progress.unknown.review')}
        </Button>
        <CopyButton text={target} label={t('wizard.result.copyPath')} doneLabel={t('wizard.result.pathCopied')} />
      </div>
    </div>
  );
}

export function GenerationProgress() {
  const { t } = useT();
  const { generation } = useWizard();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const state = generation.generation;
  if (generation.unknown) return <UnknownGeneration />;
  const running = state?.status === 'running';
  return (
    <div data-testid="generation-progress" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-title font-semibold text-ink-50">{t('wizard.progress.title')}</h2>
        <p className="break-all text-small text-ink-300">{t('wizard.progress.target', { path: generation.target ?? '' })}</p>
        {state !== null && <p className="text-small text-ink-400">{t('wizard.progress.cli', { version: state.cliVersion })}</p>}
      </header>
      {generation.connection === 'lost' && (
        <Alert variant="warning" density="compact" live="polite">
          <strong>{t('wizard.progress.lost')}</strong>
          <span className="block">{t('wizard.progress.lostBody')}</span>
        </Alert>
      )}
      {generation.error !== null && (
        <p role="alert" className="text-small text-roseish">
          {t('wizard.progress.error', { error: generation.error })}
        </p>
      )}
      {state === null ? (
        <p role="status" className="text-small text-ink-400">
          {t('wizard.progress.recovering')}
        </p>
      ) : (
        <StageList stages={state.stages} />
      )}
      <OutputLog chunks={generation.output} truncatedBefore={generation.truncatedBefore} />
      <div className="flex flex-wrap gap-2">
        {running && (
          <Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" onClick={() => setConfirmingCancel(true)}>
            {t('wizard.progress.cancel')}
          </Button>
        )}
      </div>
      <ConfirmDialog
        isOpen={confirmingCancel}
        title={t('wizard.progress.cancel.title')}
        description={t('wizard.progress.cancel.body')}
        tone="warning"
        initialFocus="cancel"
        confirmLabel={t('wizard.progress.cancel.confirm')}
        cancelLabel={t('wizard.progress.cancel.keep')}
        onConfirm={() => {
          setConfirmingCancel(false);
          void generation.cancel();
        }}
        onCancel={() => setConfirmingCancel(false)}
      />
    </div>
  );
}
