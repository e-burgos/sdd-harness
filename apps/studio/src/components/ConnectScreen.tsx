'use client';

import { Copy, ExternalLink, PlugZap } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/lib/i18n/i18n';

export const BRIDGE_COMMAND = 'npx @e-burgos/sdd-studio';
export const SDD_DOCS_URL = 'https://sdd.estebanburgos.com.ar';
const CONFIGURE_COMMAND = 'npx @e-burgos/sdd-harness configure sdd';
const INIT_COMMAND = 'npx @e-burgos/sdd-harness init';

function CommandBox({ command, label }: { command: string; label?: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const state = copied ? t('connect.copied') : t('connect.copy');
  return (
    <div>
      {label && <div className="mb-1 text-[11px] uppercase tracking-wider text-ink-500">{label}</div>}
      <div className="flex items-center gap-2 rounded-lg bg-ink-950 p-3 font-mono text-sm">
        <code className="min-w-0 flex-1 break-words text-accent-300">{command}</code>
        <button
          aria-label={`${state}: ${command}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-ink-300 hover:bg-ink-800 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(command);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          <Copy size={16} aria-hidden="true" /> <span aria-live="polite">{state}</span>
        </button>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-dim font-mono text-xs text-accent-300"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <h2 className="text-sm font-semibold text-ink-100">{title}</h2>
        {children}
      </div>
    </li>
  );
}

export function ConnectScreen({ error }: { error?: string }) {
  const { t, lang, setLang } = useT();
  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-900 p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <PlugZap aria-hidden="true" size={28} className="text-accent-400" />
          <h1 className="text-2xl font-semibold">{t('connect.title')}</h1>
          <button className="ml-auto text-xs text-ink-300 hover:text-ink-100" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>
            {t('lang.switch')}
          </button>
        </div>
        {error && <p role="alert" className="mb-4 rounded-lg border border-roseish/40 bg-roseish/10 p-3 text-sm text-roseish">{error}</p>}
        <ol aria-label={t('connect.steps')} className="space-y-5">
          <Step n={1} title={t('connect.step1.title')}>
            <p className="text-sm text-ink-300">{t('connect.step1.body')}</p>
            <CommandBox label={t('connect.step1.existing')} command={CONFIGURE_COMMAND} />
            <CommandBox label={t('connect.step1.new')} command={INIT_COMMAND} />
            <a
              href={SDD_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-accent-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            >
              {t('connect.step1.docs')} <ExternalLink size={14} aria-hidden="true" />
            </a>
          </Step>
          <Step n={2} title={t('connect.step2.title')}>
            <p className="text-sm text-ink-300">{t('connect.step2.body')}</p>
            <CommandBox command={BRIDGE_COMMAND} />
          </Step>
          <Step n={3} title={t('connect.step3.title')}>
            <p className="text-sm text-ink-300">{t('connect.step3.body')}</p>
          </Step>
        </ol>
        <section aria-label={t('connect.requirements')} className="mt-6 border-t border-ink-800 pt-4">
          <h2 className="mb-2 text-[11px] uppercase tracking-wider text-ink-500">{t('connect.requirements')}</h2>
          <ul className="list-disc space-y-1 pl-4 text-xs text-ink-300">
            <li>{t('connect.req.node')}</li>
            <li>{t('connect.auth')}</li>
            <li>{t('connect.req.chrome')}</li>
            <li>{t('connect.localUi')}</li>
          </ul>
        </section>
      </section>
    </main>
  );
}
