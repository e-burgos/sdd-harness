'use client';

import { SegmentedControl, StateBadge, type StateBadgeTone } from '@e-burgos/tucu-ui';
import type { LucideIcon } from 'lucide-react';
import type { CycleSummary } from '@sdd-studio/protocol';
import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { PANEL_TYPE, ROW_ICON } from '@/lib/typography-tokens';
import { cyclesOf } from './specs-model';

const STATUS_TONE: Record<string, StateBadgeTone> = {
  'in-progress': 'teal',
  completed: 'green',
  done: 'green',
  blocked: 'red',
  error: 'red',
  pending: 'neutral',
  planned: 'neutral',
  draft: 'neutral',
};

export const statusToneOf = (status: string): StateBadgeTone => STATUS_TONE[status] ?? 'neutral';

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <StateBadge tone={statusToneOf(status)} dot size="sm" struck={status === 'skipped'}>
      <span className="text-meta">{label ?? status}</span>
    </StateBadge>
  );
}

export function Section({ title, count, children }: { title: string; count?: number | string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1 border-t border-foreground/10 py-3 first:border-t-0 first:pt-0">
      <h3 className={`${PANEL_TYPE.group} flex items-center gap-1.5`}>
        <span>{title}</span>
        {count != null && <span className="text-meta font-normal">{count}</span>}
      </h3>
      {children}
    </section>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="text-copy text-ink-400">{children}</p>;
}

export interface ItemProps {
  label: string;
  icon?: LucideIcon;
  meta?: ReactNode;
  trailing?: ReactNode;
  mono?: boolean;
  disabled?: boolean;
  selected?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
}

export function Item({ label, icon: Icon, meta, trailing, mono = false, disabled = false, selected = false, ariaLabel, onClick }: ItemProps) {
  const body = (
    <>
      {Icon && <Icon aria-hidden size={ROW_ICON} className="shrink-0 text-ink-400" />}
      <span className={`min-w-0 flex-1 truncate text-copy ${mono ? 'font-mono' : ''} ${disabled ? 'text-ink-400' : 'text-ink-100'}`}>{label}</span>
      {meta != null && <span className="shrink-0 text-meta text-ink-400">{meta}</span>}
      {trailing}
    </>
  );
  const base = 'flex min-h-7 w-full items-center gap-2 rounded-md px-2 py-0.5 text-left';
  if (!onClick) return <div className={base}>{body}</div>;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={selected ? 'true' : undefined}
      onClick={onClick}
      className={`${base} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${selected ? 'bg-accent-dim' : 'hover:bg-ink-800'}`}
    >
      {body}
    </button>
  );
}

export const shortCycleLabel = (cycle: string) => `c${cycle.slice(6)}`;

export function CycleSelector({ cycles, specId, value, current, onChange }: { cycles: readonly CycleSummary[]; specId: string; value: string; current: string | null; onChange: (cycle: string) => void }) {
  const { t } = useT();
  const own = cyclesOf(cycles, specId);
  if (own.length < 2) return null;
  return (
    <div className="flex items-center gap-2 pb-2">
      <span className="text-meta text-ink-400">{t('specs.cycle.select')}</span>
      <SegmentedControl
        size="sm"
        aria-label={t('specs.cycle.select')}
        value={value}
        onChange={onChange}
        options={own.map((c) => ({ value: c.cycle, label: <span className="text-ui">{shortCycleLabel(c.cycle)}{c.cycle === current ? ` · ${t('specs.cycle.current')}` : ''}</span> }))}
      />
    </div>
  );
}
