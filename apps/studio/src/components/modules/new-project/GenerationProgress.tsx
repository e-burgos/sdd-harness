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
const DOT_CLASS: Record<StageStatus, string> = {
  pending: 'border-foreground/10',
  active: 'wizard-breathe border-accent-400/60 shadow-[0_0_0_4px_var(--color-accent-dim),0_0_22px_2px_var(--color-accent-dim)]',
  done: 'wizard-pop border-emerald-400/50 bg-emerald-950',
  failed: 'wizard-pop border-roseish/60 bg-rose-950',
  skipped: 'border-foreground/10',
};

const settledCount = (stages: GenerationState['stages']) => stages.filter(({ status }) => status === 'done' || status === 'skipped').length;

function StageProgressBar({ stages }: { stages: GenerationState['stages'] }) {
  const running = stages.some(({ status }) => status === 'active');
  const fraction = stages.length === 0 ? 0 : settledCount(stages) / stages.length;
  return (
    <div aria-hidden className="relative h-1 overflow-hidden rounded-full bg-foreground/10">
      <span
        data-testid="stage-progress-fill"
        className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-accent-500 via-accent-400 to-emerald-400 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        style={{ transform: `scaleX(${fraction})` }}
      />
      {running && <span key={settledCount(stages)} className="wizard-sweep absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/50 to-transparent" />}
    </div>
  );
}

export function StageList({ stages }: { stages: GenerationState['stages'] }) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-3">
      <StageProgressBar stages={stages} />
      <ol aria-label={t('wizard.progress.stages')} className="relative flex flex-col gap-2">
        <span aria-hidden className="absolute bottom-3 left-[11.5px] top-3 w-px bg-foreground/10" />
        {stages.map(({ stage, status }) => {
          const Icon = STAGE_ICON[status];
          return (
            <li key={stage} data-stage={stage} data-status={status} aria-current={status === 'active' ? 'step' : undefined} className={`relative flex items-center gap-3 text-copy ${STAGE_CLASS[status]}`}>
              <span key={status} className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-ink-950 ${DOT_CLASS[status]}`}>
                <Icon aria-hidden size={ROW_ICON - 4} className={status === 'active' ? 'animate-spin' : undefined} />
              </span>
              <span className={status === 'active' ? 'font-medium text-ink-50' : status === 'done' ? 'text-ink-100' : undefined}>{t(`wizard.progress.stage.${stage satisfies GenerationStage}` as keyof Dict)}</span>
              <span className="font-mono text-meta uppercase tracking-wider text-ink-400">{t(`wizard.progress.stageState.${status}` as keyof Dict)}</span>
            </li>
          );
        })}
      </ol>
    </div>
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
      <OutputLog chunks={generation.output} truncatedBefore={generation.truncatedBefore} revision={generation.outputVersion} />
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
