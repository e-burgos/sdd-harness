'use client';

import { Alert, Button, ConfirmDialog } from '@e-burgos/tucu-ui';
import { useState } from 'react';
import { WorkspaceOpenResult, type GenerationState } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { buildHermesIdea } from '@/lib/wizard/hermes-idea';
import { joinLog } from '@/lib/wizard/log-text';
import { savePendingIdea } from '@/lib/wizard/persist';
import { errorMessage } from '@/lib/wizard/wizard-client';
import { useBridgeFeatures } from '@/lib/use-bridge-features';
import { useBridge, useStudio } from '../../BridgeProvider';
import { CapabilityNotice } from '../../mission-control/CapabilityNotice';
import { CopyButton } from './CopyButton';
import { StageList } from './GenerationProgress';
import { OutputLog } from './OutputLog';
import { useWizard } from './wizard-context';

type ResultVariant = 'success' | 'gate-failed' | 'failed' | 'cancelled' | 'interrupted';

const variantOf = (state: GenerationState): ResultVariant => (state.status === 'running' ? 'failed' : state.status === 'succeeded' ? 'success' : state.status);

function GateLine({ label, status }: { label: string; status: GenerationState['gate']['validate'] }) {
  const { t } = useT();
  const tone = status === 'pass' ? 'text-emerald-400' : status === 'fail' ? 'text-roseish' : 'text-ink-400';
  return (
    <li data-gate-status={status} className={`text-copy ${tone}`}>
      {label}: {t(`wizard.result.gate.${status}` as keyof Dict)}
    </li>
  );
}

export function GenerationResult({ state }: { state: GenerationState }) {
  const { t, lang } = useT();
  const { client, workspaceMode } = useBridge();
  const currentProject = useStudio((s) => s.snapshot?.project ?? '');
  const switchUnavailable = useBridgeFeatures().missing(['workspace-switch']).length > 0;
  const [confirmingOpen, setConfirmingOpen] = useState(false);
  const wizard = useWizard();
  const { generation, setTargetPath, goToStep } = wizard;
  const [busy, setBusy] = useState<'open' | 'reveal' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(state.status !== 'succeeded');
  const variant = variantOf(state);
  const failed = variant !== 'success';
  const folderMayExist = !(state.failure?.stage === 'prepare' && state.failure.kind === 'prepare');

  const run = async (action: 'open' | 'reveal') => {
    setBusy(action);
    setActionError(null);
    try {
      if (action === 'open') {
        WorkspaceOpenResult.parse(await client.request({ cmd: 'workspace.open', generationId: state.id }));
        savePendingIdea(buildHermesIdea(wizard.state, lang));
      } else {
        await client.request({ cmd: 'wizard.reveal', generationId: state.id });
      }
    } catch (failure) {
      setActionError(errorMessage(failure));
    } finally {
      setBusy(null);
    }
  };

  const requestOpen = () => (workspaceMode === 'project' ? setConfirmingOpen(true) : void run('open'));

  const editAndRetry = () => {
    generation.dismiss();
    goToStep('summary');
  };

  const otherFolder = () => {
    setTargetPath('');
    generation.dismiss();
    goToStep('summary');
  };

  const items = [...wizard.state.apps.map((app) => `${app.name} · ${app.type}`), ...wizard.state.libs.map((lib) => `${lib.name} · ${lib.type}`)];

  return (
    <div data-testid="generation-result" data-variant={variant} className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-title font-semibold text-ink-50">{t(`wizard.result.${variant}.title` as keyof Dict)}</h2>
        <p className="break-all text-small text-ink-300">{t('wizard.result.path', { path: state.target })}</p>
        <p data-testid="result-cli" className="text-small text-ink-400">
          {t('wizard.result.cli', { version: state.cliVersion })}
        </p>
      </header>

      {variant === 'gate-failed' && (
        <Alert variant="warning" density="compact" live="polite">
          {t('wizard.result.gate-failed.body')}
        </Alert>
      )}

      {failed && state.failure !== null && variant !== 'gate-failed' && (
        <Alert variant="error" density="compact" live="assertive">
          <span className="block">{t(`wizard.result.failure.kind.${state.failure.kind}` as keyof Dict)}</span>
          <span className="block">{t('wizard.result.failure.stage', { stage: t(`wizard.progress.stage.${state.failure.stage}` as keyof Dict) })}</span>
          {state.exitCode !== null && <span className="block">{t('wizard.result.failure.exit', { code: state.exitCode })}</span>}
        </Alert>
      )}

      {failed && <p className="text-small text-ink-300">{t('wizard.result.nothingDeleted')}</p>}
      {failed && variant !== 'gate-failed' && folderMayExist && <p className="text-small text-ink-300">{t('wizard.result.reuse')}</p>}
      {failed && state.hasSdd === false && <p className="text-small text-ink-300">{t('wizard.result.noSdd')}</p>}

      <StageList stages={state.stages} />

      {(variant === 'success' || variant === 'gate-failed') && (
        <>
          <section className="flex flex-col gap-1">
            <h3 className="text-small font-medium text-ink-400">{t('wizard.result.gate')}</h3>
            <ul>
              <GateLine label={t('wizard.result.gate.validate')} status={state.gate.validate} />
              <GateLine label={t('wizard.result.gate.build')} status={state.gate.build} />
            </ul>
          </section>
          <section className="flex flex-col gap-1">
            <h3 className="text-small font-medium text-ink-400">{t('wizard.result.items')}</h3>
            <ul className="flex flex-col gap-px text-copy text-ink-100">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="flex flex-col gap-1">
            <h3 className="text-small font-medium text-ink-400">{t('wizard.result.next.title')}</h3>
            <ul className="list-disc pl-5 text-small text-ink-300">
              <li>{t('wizard.result.next.open')}</li>
              <li>{t('wizard.result.next.editor')}</li>
              <li>{t('wizard.result.next.remote')}</li>
            </ul>
          </section>
        </>
      )}

      {actionError !== null && (
        <p role="alert" className="text-small text-roseish">
          {t('wizard.result.actionError', { error: actionError })}
        </p>
      )}

      {state.hasSdd && switchUnavailable && (
        <div className="flex flex-col gap-1">
          <p className="text-small text-ink-300">{t('wizard.result.switch.unavailable')}</p>
          <CapabilityNotice capabilities={['workspace-switch']} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {state.hasSdd && (
          <Button type="button" size="tiny" className="text-ui" isLoading={busy === 'open'} disabled={busy !== null || switchUnavailable} onClick={requestOpen}>
            {busy === 'open' ? t('wizard.result.opening') : t('wizard.result.open')}
          </Button>
        )}
        {folderMayExist && (
          <Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" disabled={busy !== null} onClick={() => void run('reveal')}>
            {t('wizard.result.reveal')}
          </Button>
        )}
        <CopyButton text={state.target} label={t('wizard.result.copyPath')} doneLabel={t('wizard.result.pathCopied')} />
        <CopyButton text={() => joinLog(generation.output)} label={t('wizard.log.copy')} doneLabel={t('wizard.log.copied')} />
        <Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" onClick={() => setShowLog((value) => !value)}>
          {showLog ? t('wizard.log.hide') : t('wizard.log.show')}
        </Button>
        {failed && (
          <Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" onClick={editAndRetry}>
            {t('wizard.result.edit')}
          </Button>
        )}
        <Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" onClick={otherFolder}>
          {t('wizard.result.other')}
        </Button>
      </div>

      <ConfirmDialog
        isOpen={confirmingOpen}
        title={t('wizard.result.switch.title', { current: currentProject })}
        description={t('wizard.result.switch.body', { current: currentProject, path: state.target })}
        tone="warning"
        confirmLabel={t('wizard.result.switch.confirm')}
        cancelLabel={t('wizard.result.switch.cancel')}
        onConfirm={() => {
          setConfirmingOpen(false);
          void run('open');
        }}
        onCancel={() => setConfirmingOpen(false)}
      />

      {showLog && <OutputLog chunks={generation.output} truncatedBefore={generation.truncatedBefore} revision={generation.outputVersion} maxHeightClass="max-h-96" />}
    </div>
  );
}
