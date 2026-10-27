'use client';

import { useId, type ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { Select, Tooltip, type SelectOption } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';

export interface HelpSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
  icon?: ReactNode;
  description?: string;
  triggerLabel?: string;
}

export interface HelpSelectProps {
  label: string;
  help: string;
  options: HelpSelectOption[];
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
  searchable?: boolean;
  wrapperClassName?: string;
  className?: string;
}

const iconRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';
const triggerClasses = 'gap-1.5 font-normal [&>svg]:size-3';

export function HelpSelect({ label, help, options, value, onChange, disabled, searchable, wrapperClassName = '', className = 'max-w-[16rem]' }: HelpSelectProps) {
  const { t } = useT();
  const helpId = useId();
  const items: SelectOption[] = options.map((o) => ({
    name: o.label,
    value: o.value,
    disabled: o.disabled,
    group: o.group,
    icon: o.icon,
    description: o.description,
    triggerLabel: o.triggerLabel,
  }));
  const selected: SelectOption = items.find((o) => o.value === value) ?? { name: '', value };
  return (
    <span data-testid="help-select" className={`relative inline-flex min-w-0 items-center gap-1 ${wrapperClassName}`}>
      <Select
        size="xs"
        appearance="neutral"
        aria-label={label}
        aria-describedby={helpId}
        options={items}
        selectedOption={selected}
        disabled={disabled}
        className={`shrink-0 ${className}`}
        buttonClassName={triggerClasses}
        showCheck
        searchable={searchable}
        menuWidth="content"
        wrapDescription
        descriptionClassName="text-meta text-ink-400"
        maxMenuHeight={320}
        onChange={(option: SelectOption) => onChange(option.value)}
      />
      <span id={helpId} className="sr-only">
        {help}
      </span>
      <Tooltip lazy content={help} size="xs" arrow={false}>
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
