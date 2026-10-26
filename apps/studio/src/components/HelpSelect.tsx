'use client';

import { CircleHelp } from 'lucide-react';
import { useId, type SelectHTMLAttributes } from 'react';
import { useT } from '@/lib/i18n/i18n';

export interface HelpSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  help: string;
  wrapperClassName?: string;
}

const iconRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';
const tooltipVisibility = 'invisible opacity-0 group-hover/help:visible group-hover/help:opacity-100 group-focus-within/help:visible group-focus-within/help:opacity-100';

export function HelpSelect({ help, wrapperClassName = '', children, ...selectProps }: HelpSelectProps) {
  const { t } = useT();
  const tooltipId = useId();
  return (
    <span data-testid="help-select" className={`group/help relative inline-flex min-w-0 items-center gap-1 ${wrapperClassName}`}>
      <select {...selectProps} aria-describedby={[selectProps['aria-describedby'], tooltipId].filter(Boolean).join(' ')}>
        {children}
      </select>
      <button
        type="button"
        data-testid="help-select-icon"
        aria-label={t('help.icon')}
        aria-describedby={tooltipId}
        className={`inline-flex shrink-0 rounded-full text-ink-400 hover:text-ink-100 ${iconRing}`}
      >
        <CircleHelp size={14} aria-hidden />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        data-testid="help-select-tooltip"
        className={`pointer-events-none absolute bottom-full left-0 z-30 mb-1 w-max max-w-[16rem] rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-left text-[11px] font-normal normal-case leading-snug text-ink-100 shadow-lg transition-opacity ${tooltipVisibility}`}
      >
        {help}
      </span>
    </span>
  );
}
