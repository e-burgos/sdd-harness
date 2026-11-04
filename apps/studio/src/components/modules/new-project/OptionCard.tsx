'use client';

import { Badge } from '@e-burgos/tucu-ui';
import { Check } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { ROW_ICON } from '@/lib/typography-tokens';
import { focusRing } from '../../shell/shell-context';

export interface OptionCardProps {
  label: string;
  hint: string;
  selected: boolean;
  onSelect(): void;
  recommended?: string | null;
  blockedReason?: string | null;
  testId?: string;
}

export function RecommendedBadge({ reason }: { reason?: string }) {
  const { t } = useT();
  return (
    <Badge variant="soft" size="tiny" shape="pill" tone="green" title={reason} className="shrink-0 px-1.5 py-0 text-micro">
      {t('wizard.recommended')}
    </Badge>
  );
}

export function OptionCard({ label, hint, selected, onSelect, recommended = null, blockedReason = null, testId }: OptionCardProps) {
  const reasonId = useId();
  const blocked = blockedReason !== null;
  const tone = selected ? 'border-accent-400 bg-accent-dim' : 'border-foreground/10 hover:bg-ink-800';
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-describedby={blocked ? reasonId : undefined}
      disabled={blocked}
      data-testid={testId}
      onClick={onSelect}
      className={`${focusRing} flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${tone}`}
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-copy font-medium text-ink-50">{label}</span>
        {recommended !== null && <RecommendedBadge reason={recommended} />}
        {selected && <Check aria-hidden size={ROW_ICON} className="shrink-0 text-accent-400" />}
      </span>
      <span className="text-small text-ink-300">{hint}</span>
      {blocked && (
        <span id={reasonId} className="text-small text-amberish">
          {blockedReason}
        </span>
      )}
    </button>
  );
}

export function OptionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      {children}
    </div>
  );
}
