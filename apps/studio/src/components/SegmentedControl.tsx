'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  testId?: string;
  labelClassName?: string;
}

export type SegmentSemantics = 'tabs' | 'radio' | 'nav';

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange(id: T): void;
  ariaLabel: string;
  semantics: SegmentSemantics;
  idBase?: string;
  emphasis?: 'accent' | 'neutral';
  className?: string;
  testId?: string;
}

const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';
const selectedStyle = {
  accent: 'bg-emerald-500 font-semibold text-ink-950 shadow-sm',
  neutral: 'border border-foreground/15 bg-ink-800 font-medium text-ink-100 shadow-sm',
};

export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, semantics, idBase, emphasis = 'accent', className = '', testId }: SegmentedControlProps<T>) {
  const group = useRef<HTMLDivElement>(null);
  const enabled = options.filter((o) => !o.disabled);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (semantics === 'nav') return;
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    const edge = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : null;
    if (step === 0 && edge === null) return;
    event.preventDefault();
    const current = enabled.findIndex((o) => o.id === value);
    const next = enabled[edge ?? (current + step + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.id);
    group.current?.querySelector<HTMLButtonElement>(`[data-segment="${next.id}"]`)?.focus();
  };

  const containerRole = semantics === 'tabs' ? 'tablist' : semantics === 'radio' ? 'radiogroup' : undefined;
  const Container = semantics === 'nav' ? 'nav' : 'div';

  return (
    <Container
      ref={group as never}
      role={containerRole}
      aria-label={ariaLabel}
      data-testid={testId}
      className={`inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-lg border border-foreground/10 bg-foreground/5 p-0.5 ${className}`}
    >
      {options.map((option) => {
        const selected = option.id === value;
        const semanticProps =
          semantics === 'tabs'
            ? { role: 'tab', 'aria-selected': selected, tabIndex: selected ? 0 : -1, ...(idBase ? { id: `${idBase}-tab-${option.id}`, 'aria-controls': `${idBase}-panel-${option.id}` } : {}) }
            : semantics === 'radio'
              ? { role: 'radio', 'aria-checked': selected, tabIndex: selected ? 0 : -1 }
              : { 'aria-current': selected ? ('page' as const) : undefined };
        return (
          <button
            key={option.id}
            type="button"
            data-segment={option.id}
            data-testid={option.testId}
            aria-label={option.ariaLabel}
            disabled={option.disabled}
            onClick={() => onChange(option.id)}
            onKeyDown={onKeyDown}
            {...semanticProps}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-ui transition-colors disabled:cursor-not-allowed disabled:text-ink-500 ${ring} ${
              selected ? selectedStyle[emphasis] : 'text-ink-300 hover:bg-foreground/5 hover:text-ink-100'
            }`}
          >
            {option.icon}
            <span className={option.labelClassName}>{option.label}</span>
          </button>
        );
      })}
    </Container>
  );
}
