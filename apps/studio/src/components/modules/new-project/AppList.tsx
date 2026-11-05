'use client';

import { useT } from '@/lib/i18n/i18n';
import type { AppRole } from '@/lib/wizard/catalog';
import { AppRow } from './AppRow';
import { useWizard } from './wizard-context';

export function AppList({ role }: { role: AppRole }) {
  const { t } = useT();
  const { state } = useWizard();
  const rows = state.apps.flatMap((app, index) => (app.role === role ? [{ app, index }] : []));
  const front = role === 'frontend';
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-small font-medium text-ink-400">{t(front ? 'wizard.apps.listFront' : 'wizard.apps.listBack')}</h3>
      {rows.length === 0 ? (
        <p className="text-copy text-ink-400">{t(front ? 'wizard.apps.noneFront' : 'wizard.apps.noneBack')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map(({ app, index }) => (
            <AppRow key={app.id} app={app} index={index} />
          ))}
        </ul>
      )}
    </section>
  );
}
