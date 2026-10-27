'use client';

import { useId } from 'react';
import { CircleHelp } from 'lucide-react';
import { Select, Tooltip, type SelectOption } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';

export interface HelpSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

export interface HelpSelectProps {
  label: string;
  help: string;
  options: HelpSelectOption[];
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
  wrapperClassName?: string;
  className?: string;
}

const iconRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';
const triggerClasses = 'gap-1.5 rounded-md border border-ink-700 bg-ink-950 text-ink-100 font-normal [&>svg]:size-3';

export function HelpSelect({ label, help, options, value, onChange, disabled, wrapperClassName = '', className }: HelpSelectProps) {
  const { t } = useT();
  const helpId = useId();
  const items = options.map((o) => ({ name: o.label, value: o.value, disabled: o.disabled, group: o.group }));
  const selected = items.find((o) => o.value === value) ?? { name: '', value };
  return (
    <span data-testid="help-select" className={`relative inline-flex min-w-0 items-center gap-1 ${wrapperClassName}`}>
      <Select
        size="xs"
        variant="transparent"
        aria-label={label}
        aria-describedby={helpId}
        options={items}
        selectedOption={selected}
        disabled={disabled}
        className={className}
        buttonClassName={triggerClasses}
        listboxClassName="min-w-40"
        onChange={(option: SelectOption) => onChange(option.value)}
      />
      <span id={helpId} className="sr-only">
        {help}
      </span>
      <Tooltip content={help} size="xs" arrow={false}>
        <button
          type="button"
          data-testid="help-select-icon"
          aria-label={t('help.icon')}
          className={`inline-flex shrink-0 rounded-full text-ink-400 hover:text-ink-100 ${iconRing}`}
        >
          <CircleHelp size={14} aria-hidden />
        </button>
      </Tooltip>
    </span>
  );
}
