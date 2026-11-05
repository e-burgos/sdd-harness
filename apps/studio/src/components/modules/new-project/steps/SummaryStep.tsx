'use client';

import { Alert, Button } from '@e-burgos/tucu-ui';
import { useT, type TFunction } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { initCommand, summaryModel, type SummaryApp } from '@/lib/wizard/summary-model';
import type { WizardStepId } from '@/lib/wizard/state';
import { generateBlock } from '@/lib/wizard/generate-gate';
import { useLaunch, type LaunchNotice } from '@/lib/wizard/use-launch';
import { usePreflight } from '@/lib/wizard/use-preflight';
import { useTargetCheck } from '@/lib/wizard/use-target-check';
import { useBridge } from '../../../BridgeProvider';
import { ConfigPreview } from '../ConfigPreview';
import { ConfirmTargetDialog } from '../ConfirmTargetDialog';
import { PreflightNotice } from '../PreflightNotice';
import { TargetPicker } from '../TargetPicker';
import { ProjectTree } from '../ProjectTree';
import { SummarySection } from '../SummarySection';
import { useWizard } from '../wizard-context';
import { lookupText } from '../wizard-text';

function AppLine({ app }: { app: SummaryApp }) {
  const { t } = useT();
  const details = [
    app.port !== null ? `${t('wizard.summary.appPort', { port: app.port })}${app.portSource ? ` (${t(`wizard.summary.portSource.${app.portSource}` as keyof Dict)})` : ''}` : null,
    app.tucuUi === null ? null : t(app.tucuUi ? 'wizard.summary.tucuUi' : 'wizard.summary.noTucuUi'),
    app.shell !== null ? t('wizard.summary.shellOf', { shell: app.shell }) : null,
    app.route,
  ].filter((part): part is string => part !== null);
  return (
    <li data-summary-app={app.name} className="flex flex-col gap-px">
      <span className="text-copy text-ink-100">{t('wizard.summary.appLine', { name: app.name, type: app.type })}</span>
      <span className="text-small text-ink-300">{app.stack}</span>
      {details.length > 0 && <span className="text-small text-ink-400">{details.join(' · ')}</span>}
    </li>
  );
}

export function SummaryStep() {
  const { t } = useT();
  const { catalog, info, state, validation, issues, canGenerate, config, targetPath, generation } = useWizard();
  const { client } = useBridge();
  const target = useTargetCheck(client, targetPath);
  const preflight = usePreflight(client);
  const launch = useLaunch(client, generation.adopt);
  if (catalog === null || info === null) return null;
  const block = generateBlock({ fieldsReady: canGenerate && config !== null, targetPath, target, preflight, starting: launch.starting });
  const resolved = validation.validation?.resolved ?? null;
  const model = summaryModel(state, catalog, resolved);
  const appsStep: WizardStepId = state.scope === 'back' ? 'back' : 'front';
  const blocking = issues.filter((issue) => issue.severity === 'error');
  return (
    <div className="flex flex-col gap-4">
      {validation.status === 'validating' ? (
        <Alert variant="info" density="compact" live="polite">
          {t('wizard.summary.validating')}
        </Alert>
      ) : canGenerate ? (
        <Alert variant="success" density="compact" live="polite">
          {t('wizard.summary.ready')}
        </Alert>
      ) : blocking.length > 0 ? (
        <Alert variant="error" density="compact" live="polite">
          {t('wizard.summary.pending', { count: blocking.length })}
        </Alert>
      ) : null}
      <SummarySection id="profile" title={t('wizard.summary.profile')} editStep="shape">
        <p className="text-copy text-ink-100">{state.project.name}</p>
        <p className="text-small text-ink-300">{state.project.description}</p>
        <p className="text-small text-ink-300">
          {model.mode !== null && t('wizard.summary.mode', { mode: t(`wizard.mode.${model.mode}.label` as keyof Dict) })} · {t('wizard.summary.profileValue', { profile: model.profile })}
        </p>
      </SummarySection>
      <SummarySection id="tree" title={t('wizard.summary.tree')} editStep="shape">
        <ProjectTree />
      </SummarySection>
      <SummarySection id="apps" title={t('wizard.summary.apps')} editStep={appsStep}>
        <ul className="flex flex-col gap-2">
          {model.apps.map((app) => (
            <AppLine key={app.name} app={app} />
          ))}
        </ul>
      </SummarySection>
      <SummarySection id="libs" title={t('wizard.summary.libs')} editStep="extras">
        {model.libs.length === 0 ? (
          <p className="text-small text-ink-400">{t('wizard.summary.noLibs')}</p>
        ) : (
          <ul className="flex flex-col gap-px text-copy text-ink-100">
            {model.libs.map((lib) => (
              <li key={lib.name}>{t('wizard.summary.appLine', { name: lib.name, type: lib.type })}</li>
            ))}
          </ul>
        )}
      </SummarySection>
      <SummarySection id="services" title={t('wizard.summary.services')} editStep="extras">
        {model.services.length === 0 ? (
          <p className="text-small text-ink-400">{t('wizard.summary.noServices')}</p>
        ) : (
          <ul className="flex flex-col gap-px text-copy text-ink-100">
            {model.services.map((service) => (
              <li key={service.type}>{t('wizard.summary.servicePort', { label: service.label, port: service.port })}</li>
            ))}
          </ul>
        )}
      </SummarySection>
      <SummarySection id="commands" title={t('wizard.summary.commands')}>
        <p className="text-small text-ink-300">{t('wizard.summary.commandsHint')}</p>
        <code data-testid="init-command" className="block w-fit max-w-full overflow-x-auto rounded-md bg-ink-950 px-2 py-1 font-mono text-meta text-ink-100">
          {initCommand(info.initArgv)}
        </code>
        <ol className="list-decimal pl-5 text-small text-ink-300">
          <li>{t('wizard.summary.command.init')}</li>
          <li>{t('wizard.summary.command.install')}</li>
          <li>{t('wizard.summary.command.validate')}</li>
          <li>{t('wizard.summary.command.gate')}</li>
        </ol>
      </SummarySection>
      <SummarySection id="config" title={t('wizard.summary.config')}>
        <p className="text-small text-ink-300">{t('wizard.summary.configHint')}</p>
        <ConfigPreview label={t('wizard.summary.config')} />
      </SummarySection>
      <SummarySection id="target" title={t('wizard.target.title')}>
        <TargetPicker status={target} />
      </SummarySection>
      <SummarySection id="preflight" title={t('wizard.preflight.title')}>
        <PreflightNotice preflight={preflight} />
      </SummarySection>
      <div className="flex flex-col gap-2">
        {launch.notice !== null && (
          <Alert variant="error" density="compact" live="assertive">
            {noticeText(t, launch.notice)}
          </Alert>
        )}
        {block !== null && block !== 'starting' && (
          <p data-testid="generate-blocked-reason" role="status" className="text-small text-amberish">
            {t('wizard.generate.blocked', { reason: t(`wizard.generate.reason.${block}` as keyof Dict) })}
          </p>
        )}
        <Button
          type="button"
          size="tiny"
          className="w-fit text-ui"
          disabled={block !== null}
          isLoading={launch.starting}
          onClick={() => config !== null && target.check !== null && launch.start(config, targetPath.trim(), target.check)}
        >
          {launch.starting ? t('wizard.generate.starting') : t('wizard.generate.button')}
        </Button>
      </div>
      <ConfirmTargetDialog confirmation={launch.confirmation} loading={launch.starting} onConfirm={launch.confirm} onCancel={launch.cancelConfirmation} />
    </div>
  );
}

function noticeText(t: TFunction, notice: LaunchNotice): string {
  switch (notice.kind) {
    case 'blocked':
      return lookupText(t, `wizard.generate.blocked.${notice.reason ?? 'other'}`, { reason: notice.reason ?? '' }) ?? t('wizard.generate.blocked.other', { reason: notice.reason ?? '' });
    case 'invalid-config':
      return t('wizard.generate.invalidConfig');
    case 'conflict':
      return t('wizard.generate.conflict', { message: notice.message });
    case 'error':
      return t('wizard.generate.error', { error: notice.message });
  }
}
