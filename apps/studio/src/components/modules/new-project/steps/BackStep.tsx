'use client';

import { Alert } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { backendFamilies, typeOptions } from '@/lib/wizard/catalog';
import { AppList } from '../AppList';
import { AppTypePicker } from '../AppTypePicker';
import { useWizard } from '../wizard-context';

export function BackStep() {
  const { t } = useT();
  const { catalog, state } = useWizard();
  if (catalog === null) return null;
  const options = typeOptions(catalog, state.mode, 'backend');
  const needsUpstream = state.apps.some((app) => app.type === 'next-bff');
  return (
    <div className="flex flex-col gap-6">
      {needsUpstream && (
        <Alert variant="info" density="compact">
          {t('wizard.apps.bffNote')}
        </Alert>
      )}
      {backendFamilies(catalog).map((family) => (
        <section key={family.id} data-family={family.id} className="flex flex-col gap-2">
          <div className="flex flex-col gap-px">
            <h3 className="text-copy font-medium text-ink-50">{t(`wizard.family.${family.id}.label` as keyof Dict)}</h3>
            <p className="text-small text-ink-300">{t(`wizard.family.${family.id}.hint` as keyof Dict)}</p>
          </div>
          <ul className="flex flex-col gap-2">
            {family.options.flatMap((entry) => {
              const option = options.find((candidate) => candidate.type === entry.type);
              return option ? [<AppTypePicker key={entry.type} option={option} />] : [];
            })}
          </ul>
        </section>
      ))}
      <AppList role="backend" />
    </div>
  );
}
