'use client';

import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import type { WizardScope } from '@/lib/wizard/catalog';
import { OptionCard, OptionGroup } from '../OptionCard';
import { useWizard } from '../wizard-context';

const SCOPES: readonly WizardScope[] = ['fullstack', 'front', 'back'];

export function ScopeStep() {
  const { t } = useT();
  const { state, requestChange } = useWizard();
  return (
    <OptionGroup label={t('wizard.scope.group')}>
      {SCOPES.map((scope) => (
        <OptionCard
          key={scope}
          testId={`scope-${scope}`}
          label={t(`wizard.scope.${scope}.label` as keyof Dict)}
          hint={t(`wizard.scope.${scope}.hint` as keyof Dict)}
          selected={state.scope === scope}
          onSelect={() => requestChange({ type: 'scope', scope })}
        />
      ))}
    </OptionGroup>
  );
}
