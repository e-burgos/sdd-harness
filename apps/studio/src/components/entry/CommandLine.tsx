'use client';

import { Button } from '@e-burgos/tucu-ui';
import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/i18n';

const COPIED_RESET_MS = 2000;

function useCopy(command: string): [boolean, () => Promise<void>] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return [copied, copy];
}

export function CommandLine({ command, label, prompt = true }: { command: string; label?: string; prompt?: boolean }) {
  const { t } = useT();
  const [copied, copy] = useCopy(command);
  const state = copied ? t('entry.connect.copied') : t('entry.connect.copy');
  return (
    <div data-command-line className="flex min-w-0 flex-col gap-1">
      {label && <span className="font-mono text-meta uppercase tracking-[0.18em] text-ink-500">{label}</span>}
      <div className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-ink-950/80 py-1.5 pl-3 pr-1.5 font-mono text-small">
        {prompt && (
          <span aria-hidden className="select-none text-emerald-400">
            $
          </span>
        )}
        <code className="min-w-0 flex-1 break-all text-accent-300">{command}</code>
        <Button type="button" variant="transparent" color="gray" size="tiny" className="shrink-0 text-ui" aria-label={`${state}: ${command}`} onClick={() => void copy()}>
          {copied ? <Check size={14} aria-hidden className="wizard-pop text-emerald-400" /> : <Copy size={14} aria-hidden />}
          <span aria-live="polite" className="hidden sm:inline">
            {state}
          </span>
        </Button>
      </div>
    </div>
  );
}
