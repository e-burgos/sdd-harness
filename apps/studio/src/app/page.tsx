'use client';

import { ConnectScreen } from '@/components/ConnectScreen';
import { I18nProvider } from '@/lib/i18n/i18n';

export default function Home() {
  return (
    <I18nProvider>
      <ConnectScreen />
    </I18nProvider>
  );
}
