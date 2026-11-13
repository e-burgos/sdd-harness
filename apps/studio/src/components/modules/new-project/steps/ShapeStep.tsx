'use client';

import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { HelpSelect } from '../../../HelpSelect';
import { modeBlockReason, nxChoices, nxSelectable, type WizardMode } from '@/lib/wizard/catalog';
import { effectiveNxVersion } from '@/lib/wizard/state';
import { isRecommended } from '@/lib/wizard/recommendations';
import { OptionCard, OptionGroup } from '../OptionCard';
import { WizardField } from '../WizardField';
import { useWizard } from '../wizard-context';
import { blockReasonText, recommendationText } from '../wizard-text';

const MODES: readonly WizardMode[] = ['nx', 'standalone'];

export function ShapeStep() {
  const { t } = useT();
  const { catalog, state, requestChange, dispatch, fieldError, touch, recommendations } = useWizard();
  if (catalog === null) return null;
  const nxMajor = effectiveNxVersion(state, catalog);
  const modeRecommendation = recommendations.find((item) => item.kind === 'mode');
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <OptionGroup label={t('wizard.mode.group')}>
          {MODES.map((mode) => {
            const block = modeBlockReason(catalog, mode, state.scope);
            return (
              <OptionCard
                key={mode}
                testId={`mode-${mode}`}
                label={t(`wizard.mode.${mode}.label` as keyof Dict)}
                hint={t(`wizard.mode.${mode}.hint` as keyof Dict)}
                selected={state.mode === mode}
                blockedReason={block === null ? null : blockReasonText(t, block)}
                recommended={isRecommended(recommendations, 'mode', mode) && modeRecommendation ? recommendationText(t, modeRecommendation) : null}
                onSelect={() => requestChange({ type: 'mode', mode })}
              />
            );
          })}
        </OptionGroup>
        {modeRecommendation && <p className="text-small text-ink-400">{recommendationText(t, modeRecommendation)}</p>}
      </div>
      {nxSelectable(catalog, state.mode) && nxMajor !== null && (
        <div data-testid="nx-version" className="flex flex-col gap-1">
          <span className="text-small font-medium text-ink-300">{t('wizard.nx.label')}</span>
          <HelpSelect
            label={t('wizard.nx.label')}
            help={t('wizard.nx.help')}
            value={String(nxMajor)}
            options={nxChoices(catalog).map((choice) => ({
              value: String(choice.major),
              label: t(choice.recommended ? 'wizard.nx.optionRecommended' : 'wizard.nx.option', { major: choice.major }),
              description: t('wizard.nx.full', { version: choice.version }),
            }))}
            onChange={(value) => dispatch({ type: 'nx-version', major: Number(value) })}
          />
        </div>
      )}
      <div className="flex flex-col gap-3">
        <WizardField
          field="project.name"
          label={t('wizard.project.name')}
          value={state.project.name}
          placeholder={t('wizard.project.namePlaceholder')}
          error={fieldError('project.name')}
          onChange={(name) => dispatch({ type: 'project', patch: { name } })}
          onBlur={() => touch('project.name')}
        />
        <WizardField
          field="project.description"
          label={t('wizard.project.description')}
          value={state.project.description}
          placeholder={t('wizard.project.descriptionPlaceholder')}
          error={fieldError('project.description')}
          onChange={(description) => dispatch({ type: 'project', patch: { description } })}
          onBlur={() => touch('project.description')}
        />
        <WizardField
          field="project.packageScope"
          label={t('wizard.project.packageScope')}
          value={state.project.packageScope}
          hint={t('wizard.project.packageScopeHint')}
          error={fieldError('project.packageScope')}
          onChange={(packageScope) => dispatch({ type: 'project', patch: { packageScope } })}
          onBlur={() => touch('project.packageScope')}
        />
      </div>
    </div>
  );
}
