'use client';

import { useT } from '@/lib/i18n/i18n';
import { typeOptions } from '@/lib/wizard/catalog';
import { AppList } from '../AppList';
import { AppTypePicker } from '../AppTypePicker';
import { useWizard } from '../wizard-context';

export function FrontStep() {
  const { t } = useT();
  const { catalog, state } = useWizard();
  if (catalog === null) return null;
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-small font-medium text-ink-400">{t('wizard.apps.available')}</h3>
        <ul className="flex flex-col gap-2">
          {typeOptions(catalog, state.mode, 'frontend').map((option) => (
            <AppTypePicker key={option.type} option={option} />
          ))}
        </ul>
      </section>
      <AppList role="frontend" />
    </div>
  );
}
