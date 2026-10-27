'use client';

import { CircleHelp } from 'lucide-react';
import { Select, type SelectOption } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';
import { Tip } from './Tip';

export interface HelpSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
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

export const groupHeader = (label: string): HelpSelectOption => ({ value: `group:${label}`, label, disabled: true });

export function HelpSelect({ label, help, options, value, onChange, disabled, wrapperClassName = '', className }: HelpSelectProps) {
  const { t } = useT();
  const items = options.map((o) => ({ name: o.label, value: o.value, disabled: o.disabled }));
  const selected = items.find((o) => o.value === value) ?? { name: '', value };
  return (
    <span data-testid="help-select" data-help-select="" className={`relative inline-flex min-w-0 items-center gap-1 ${wrapperClassName}`}>
      <Select
        size="sm"
        label={label}
        helperText={help}
        options={items}
        selectedOption={selected}
        disabled={disabled}
        className={className}
        onChange={(option: SelectOption) => {
          if (option.value !== value) onChange(option.value);
        }}
      />
      <Tip text={help}>
        <button
          type="button"
          data-testid="help-select-icon"
          aria-label={t('help.icon')}
          className={`inline-flex shrink-0 rounded-full text-ink-400 hover:text-ink-100 ${iconRing}`}
        >
          <CircleHelp size={14} aria-hidden />
        </button>
      </Tip>
    </span>
  );
}
