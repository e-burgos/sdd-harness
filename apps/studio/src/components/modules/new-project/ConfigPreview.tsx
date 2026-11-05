'use client';

import { useT } from '@/lib/i18n/i18n';
import { useWizard } from './wizard-context';

export function ConfigPreview({ label }: { label: string }) {
  const { t } = useT();
  const { config } = useWizard();
  if (config === null) return <p className="text-small text-ink-400">{t('wizard.summary.unavailable')}</p>;
  return (
    <pre
      tabIndex={0}
      aria-label={label}
      data-testid="config-preview"
      className="max-h-80 overflow-auto rounded-md border border-foreground/10 bg-ink-950 p-3 font-mono text-meta text-ink-100"
    >
      {JSON.stringify(config, null, 2)}
    </pre>
  );
}
