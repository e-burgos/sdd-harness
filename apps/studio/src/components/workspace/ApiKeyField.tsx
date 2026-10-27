'use client';

import { Button, Checkbox, Input } from '@e-burgos/tucu-ui';
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

  return (
    <form
      className="flex flex-col gap-2 text-meta text-ink-300"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isPlausibleApiKey(value)) return setError(t('apikey.invalid'));
        void submit(value);
      }}
    >
      <label className="flex flex-col gap-1">
        {t('apikey.label')}
        <Input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-ant-…"
          inputClassName="h-auto! sm:h-auto! rounded-md! px-2! py-1! pr-9! text-ui!"
        />
      </label>
      <Checkbox
        size="sm"
        checked={remember}
        onChange={(e) => setRemember(e.target.checked)}
        label={t('apikey.remember')}
        labelClassName="text-meta! text-ink-300"
      />
      {apiKeySource && <p>{t(apiKeySource === 'saved' ? 'apikey.stored.saved' : 'apikey.stored.tab')}</p>}
      <p>{t('apikey.privacy')}</p>
      {authMode === 'api-key' && apiKeySource === null && <p>{t('apikey.fromEnv')}</p>}
      {error && <p role="alert" className="text-roseish">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="tiny" disabled={busy}>{t('apikey.save')}</Button>
        {apiKeySource && <Button type="button" variant="transparent" color="gray" size="tiny" disabled={busy} onClick={() => void submit(null)}>{t('apikey.remove')}</Button>}
      </div>
    </form>
  );
}
