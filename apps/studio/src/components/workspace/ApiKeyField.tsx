'use client';

import { useState } from 'react';
import { isPlausibleApiKey } from '@/lib/api-key';
import { useT } from '@/lib/i18n/i18n';
import { useBridge } from '../BridgeProvider';

export function ApiKeyField() {
  const { t } = useT();
  const { authMode, apiKeySource, setApiKey } = useBridge();
  const [value, setValue] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (next: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await setApiKey(next, remember);
      setValue('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';

  return (
    <form
      className="flex flex-col gap-2 text-[11px] text-ink-300"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isPlausibleApiKey(value)) return setError(t('apikey.invalid'));
        void submit(value);
      }}
    >
      <label className="flex flex-col gap-1">
        {t('apikey.label')}
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-ant-…"
          className={`rounded border border-ink-700 bg-ink-950 px-2 py-1 text-ink-100 ${ring}`}
        />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        {t('apikey.remember')}
      </label>
      {apiKeySource && <p>{t(apiKeySource === 'saved' ? 'apikey.stored.saved' : 'apikey.stored.tab')}</p>}
      <p>{t('apikey.privacy')}</p>
      {authMode === 'api-key' && apiKeySource === null && <p>{t('apikey.fromEnv')}</p>}
      {error && <p role="alert" className="text-roseish">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={`rounded bg-accent-dim px-2 py-1 text-accent-300 ${ring}`}>{t('apikey.save')}</button>
        {apiKeySource && <button type="button" disabled={busy} className={`rounded px-2 py-1 hover:text-ink-100 ${ring}`} onClick={() => void submit(null)}>{t('apikey.remove')}</button>}
      </div>
    </form>
  );
}
