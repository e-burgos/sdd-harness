'use client';

import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';

export function ViewFrame({ title, description, actions, children }: { title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section data-metrics-view className="mx-auto flex h-full w-full max-w-5xl flex-col gap-5 overflow-y-auto p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-title font-semibold text-ink-50">{title}</h1>
          <p className="text-small text-ink-400">{description}</p>
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function Section({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-foreground/10 pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-small font-medium text-ink-400">{title}</h2>
        {meta != null && <span className="text-meta text-ink-400">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

export function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ShareRow({ label, value, meta, pct }: { label: string; value: ReactNode; meta?: ReactNode; pct: number }) {
  return (
    <div data-share-row className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-copy text-ink-100">{label}</span>
        <span className="shrink-0 font-mono text-ui text-ink-100">{value}</span>
      </div>
      <ProgressBar pct={pct} label={label} />
      {meta != null && <span className="text-meta text-ink-400">{meta}</span>}
    </div>
  );
}

export function useStatusLabel(): (status: string) => string {
  const { t } = useT();
  return (status) => {
    const key = `metrics.status.${status}` as keyof Dict;
    const label = t(key);
    return label === key ? status : label;
  };
}
