'use client';

import { CopySimple, Plugs } from '@phosphor-icons/react';
import { useState } from 'react';
import { useT } from '@/lib/i18n/i18n';

export const BRIDGE_COMMAND = 'npx @e-burgos/sdd-studio';

export function ConnectScreen({ error }: { error?: string }) {
  const { t, lang, setLang } = useT();
  const [copied, setCopied] = useState(false);
  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-900 p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <Plugs aria-hidden="true" size={28} className="text-accent-400" weight="duotone" />
          <h1 className="text-2xl font-semibold">{t('connect.title')}</h1>
          <button className="ml-auto text-xs text-ink-300 hover:text-ink-100" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>
            {t('lang.switch')}
          </button>
        </div>
        {error && <p role="alert" className="mb-4 rounded-lg border border-roseish/40 bg-roseish/10 p-3 text-sm text-roseish">{error}</p>}
        <p className="mb-3 text-ink-300">{t('connect.body')}</p>
        <div className="flex items-center gap-2 rounded-lg bg-ink-950 p-3 font-mono text-sm">
          <code className="flex-1 text-accent-300">{BRIDGE_COMMAND}</code>
          <button
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-ink-300 hover:bg-ink-800 hover:text-ink-100"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(BRIDGE_COMMAND);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            <CopySimple size={16} aria-hidden="true" /> <span aria-live="polite">{copied ? t('connect.copied') : t('connect.copy')}</span>
          </button>
        </div>
        <p className="mt-4 text-xs text-ink-300">{t('connect.auth')}</p>
        <p className="mt-2 text-xs text-ink-500">{t('connect.localUi')}</p>
      </section>
    </main>
  );
}
