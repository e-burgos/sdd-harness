'use client';

import { Input } from '@e-burgos/tucu-ui';
import { useId } from 'react';
import { fieldDomId } from '@/lib/wizard/step-gate';

export interface WizardFieldProps {
  field: string;
  label: string;
  value: string;
  onChange?(value: string): void;
  onBlur?(): void;
  error?: string | null;
  hint?: string | null;
  placeholder?: string;
  readOnly?: boolean;
  inputMode?: 'text' | 'numeric';
}

export function WizardField({ field, label, value, onChange, onBlur, error = null, hint = null, placeholder, readOnly = false, inputMode = 'text' }: WizardFieldProps) {
  const id = fieldDomId(field);
  const messageId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-small font-medium text-ink-300">
        {label}
      </label>
      <Input
        id={id}
        value={value}
        readOnly={readOnly}
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        autoValidate={false}
        placeholder={placeholder}
        aria-invalid={error !== null}
        aria-describedby={error !== null || hint !== null ? messageId : undefined}
        onChange={(event) => onChange?.(event.target.value)}
        onBlur={onBlur}
        inputClassName="h-auto sm:h-auto rounded-md px-2 py-1 text-ui"
      />
      {(error !== null || hint !== null) && (
        <p id={messageId} role={error !== null ? 'alert' : undefined} className={`text-small ${error !== null ? 'text-roseish' : 'text-ink-400'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
