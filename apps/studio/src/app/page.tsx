'use client';

import { EntryWizard } from '@/components/entry/EntryWizard';
import { I18nProvider } from '@/lib/i18n/i18n';

export default function Home() {
  return (
    <I18nProvider>
      <EntryWizard />
    </I18nProvider>
  );
}
