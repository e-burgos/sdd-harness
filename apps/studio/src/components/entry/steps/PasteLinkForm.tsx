'use client';

import { Button, Input } from '@e-burgos/tucu-ui';
import { ArrowRight, Link2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { validateBridgeLink } from '../bridge-link';

export function PasteLinkForm({ onNavigate }: { onNavigate(href: string): void }) {
  const { t } = useT();
  const [value, setValue] = useState('');
  const [error, setError] = useState<keyof Dict | null>(null);
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  return (
    <form
      noValidate
      aria-label={t('entry.connect.paste.label')}
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const result = validateBridgeLink(value, window.location.origin);
        if (!result.ok) {
          setError(`entry.connect.paste.error.${result.reason}`);
          return;
        }
        setError(null);
        onNavigate(result.href);
      }}
    >
      <label htmlFor={inputId} className="flex items-center gap-2 text-small font-medium text-ink-100">
        <Link2 aria-hidden size={14} className="text-accent-300" />
        {t('entry.connect.paste.label')}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          placeholder={t('entry.connect.paste.placeholder')}
          aria-invalid={error !== null}
          aria-describedby={error ? `${errorId} ${hintId}` : hintId}
          className="min-w-0 flex-1"
          inputClassName="font-mono text-small"
        />
        <Button type="submit" size="small" className="shrink-0 gap-1.5 text-ui">
          {t('entry.connect.paste.submit')}
          <ArrowRight aria-hidden size={14} />
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-small text-roseish">
          {t(error)}
        </p>
      )}
      <p id={hintId} className="text-meta text-ink-500">
        {t('entry.connect.paste.hint')}
      </p>
    </form>
  );
}
