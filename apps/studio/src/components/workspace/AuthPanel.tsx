'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { KeyRound, LogIn, LogOut, RefreshCw, ExternalLink } from 'lucide-react';
import type { AuthPreference } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { useSubscription } from '@/lib/use-subscription';
import { useBridge } from '../BridgeProvider';
import { ApiKeyField } from './ApiKeyField';

const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';
const TABS: AuthPreference[] = ['subscription', 'api-key'];

function SubscriptionTab({ active }: { active: boolean }) {
  const { t } = useT();
  const { client } = useBridge();
  const { account, busy, failure, login, logout } = useSubscription(client, active);
  const [confirming, setConfirming] = useState(false);
  const state = account?.state ?? 'disconnected';
  const details = account ? [account.email, account.method, account.plan].filter(Boolean).join(' · ') : '';
  const message = failure ?? (state === 'error' ? account?.error : null) ?? (state === 'disconnected' ? account?.error : null);
  const connectLabel = state === 'connected' ? t('auth.sub.switch') : t('auth.sub.connect');

  return (
    <div className="flex flex-col gap-2 text-[11px] text-ink-300">
      <p aria-live="polite">
        {state === 'connected' && t('auth.sub.connected', { details })}
        {state === 'pending' && t('auth.sub.pending')}
        {(state === 'disconnected' || state === 'error') && t('auth.sub.disconnected')}
      </p>
      {state === 'pending' && account?.loginUrl && (
        <a href={account.loginUrl} target="_blank" rel="noreferrer noopener" className={`inline-flex items-center gap-1 rounded text-accent-300 hover:underline ${ring}`}>
          <ExternalLink size={12} aria-hidden /> {t('auth.sub.openLink')}
        </a>
      )}
      {message && <p role="alert" className="text-roseish">{message}</p>}
      {confirming ? (
        <div className="flex flex-col gap-2 rounded border border-ink-700 p-2">
          <p>{t('auth.sub.confirmLogout')}</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} className={`rounded bg-accent-dim px-2 py-1 text-accent-300 ${ring}`} onClick={() => { setConfirming(false); void logout(); }}>{t('auth.sub.confirm')}</button>
            <button type="button" className={`rounded px-2 py-1 hover:text-ink-100 ${ring}`} onClick={() => setConfirming(false)}>{t('apikey.cancel')}</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {state !== 'pending' && (
            <button type="button" disabled={busy} className={`inline-flex items-center gap-1 rounded bg-accent-dim px-2 py-1 text-accent-300 ${ring}`} onClick={() => void login()}>
              {state === 'connected' ? <RefreshCw size={12} aria-hidden /> : <LogIn size={12} aria-hidden />} {connectLabel}
            </button>
          )}
          {state === 'connected' && (
            <button type="button" disabled={busy} className={`inline-flex items-center gap-1 rounded px-2 py-1 hover:text-ink-100 ${ring}`} onClick={() => setConfirming(true)}>
              <LogOut size={12} aria-hidden /> {t('auth.sub.disconnect')}
            </button>
          )}
        </div>
      )}
      <p>{t('auth.sub.privacy')}</p>
    </div>
  );
}

export function AuthPanel() {
  const { t } = useT();
  const { authMode, authPreference, setAuthPreference, connection } = useBridge();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baseId = useId();
  const supported = connection.status !== 'open' || !!connection.welcome?.features?.includes('auth-subscription');
  const selected: AuthPreference = authPreference ?? (authMode === 'api-key' ? 'api-key' : 'subscription');

  const select = (next: AuthPreference) => {
    setError(null);
    if (next === selected) return;
    setAuthPreference(next).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = TABS[(TABS.indexOf(selected) + 1) % TABS.length];
    select(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  };

  if (!open) {
    return (
      <button className={`mt-1 inline-flex items-center gap-1 rounded px-1 text-[11px] text-ink-300 hover:text-ink-100 ${ring}`} onClick={() => setOpen(true)}>
        <KeyRound size={12} aria-hidden /> {t('auth.panel.open')}
      </button>
    );
  }
  return (
    <section aria-label={t('auth.panel.title')} className="mt-2 rounded-md border border-ink-800 p-2">
      <div role="tablist" aria-label={t('auth.panel.title')} className="mb-2 flex gap-1 text-[11px]">
        {TABS.map((tab) => (
          <button
            key={tab}
            id={`${baseId}-tab-${tab}`}
            role="tab"
            type="button"
            aria-selected={selected === tab}
            aria-controls={`${baseId}-panel-${tab}`}
            tabIndex={selected === tab ? 0 : -1}
            onClick={() => select(tab)}
            onKeyDown={onKeyDown}
            className={`rounded px-2 py-1 ${ring} ${selected === tab ? 'bg-accent-dim text-accent-300' : 'text-ink-300 hover:text-ink-100'}`}
          >
            {t(tab === 'subscription' ? 'auth.tab.subscription' : 'auth.tab.apikey')}
          </button>
        ))}
        <button type="button" className={`ml-auto rounded px-2 py-1 text-ink-300 hover:text-ink-100 ${ring}`} onClick={() => setOpen(false)}>{t('auth.panel.close')}</button>
      </div>
      {error && <p role="alert" className="mb-2 text-[11px] text-roseish">{error}</p>}
      <div role="tabpanel" id={`${baseId}-panel-${selected}`} aria-labelledby={`${baseId}-tab-${selected}`}>
        {selected === 'subscription' ? (supported ? <SubscriptionTab active /> : <p className="text-[11px] text-ink-300">{t('auth.sub.unsupported')}</p>) : <ApiKeyField />}
      </div>
    </section>
  );
}
