'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { PANEL_TYPE, ROW_HEIGHT, ROW_ICON } from '@/lib/typography-tokens';
import { focusRing } from './shell-context';

export interface PanelRowProps {
  label: string;
  icon?: LucideIcon;
  leading?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  indent?: boolean;
  title?: string;
  ariaLabel?: string;
  onClick?: () => void;
}

export function PanelRow({ label, icon: Icon, leading, meta, trailing, selected = false, indent = false, title, ariaLabel, onClick }: PanelRowProps) {
  const tone = selected ? 'bg-accent-dim text-ink-50' : 'text-ink-100 hover:bg-ink-800';
  const content = (
    <>
      {leading ?? (Icon ? <Icon aria-hidden size={ROW_ICON} className="shrink-0 text-ink-400" /> : null)}
      <span className={`${PANEL_TYPE.item} min-w-0 flex-1 truncate`}>{label}</span>
      {meta != null && <span className={`${PANEL_TYPE.meta} shrink-0 text-ink-400`}>{meta}</span>}
      {trailing}
    </>
  );
  const base = `flex ${ROW_HEIGHT} w-full items-center gap-2 rounded-md ${indent ? 'pl-6 pr-2' : 'px-2'} text-left`;
  if (!onClick) {
    return (
      <div className={`${base} ${PANEL_TYPE.item}`} title={title}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      title={title ?? label}
      aria-label={ariaLabel}
      aria-current={selected ? 'true' : undefined}
      onClick={onClick}
      className={`${base} ${focusRing} transition-colors ${tone}`}
    >
      {content}
    </button>
  );
}
