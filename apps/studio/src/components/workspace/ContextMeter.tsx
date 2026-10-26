'use client';

import { Gauge, MessageSquarePlus } from 'lucide-react';
import type { ContextUsage } from '@sdd-studio/protocol';
import { contextMeterOf, type ContextLevel } from '@/lib/context-meter';
import { formatTokens } from '@/lib/format';
import { useT } from '@/lib/i18n/i18n';

const BAR: Record<ContextLevel, string> = {
  none: 'bg-ink-700',
  ok: 'bg-accent-400',
  warn: 'bg-amberish',
  critical: 'bg-roseish',
};

export function ContextMeter({ usage, onNewConversation }: { usage: ContextUsage | null | undefined; onNewConversation?: () => void }) {
  const { t } = useT();
  const reading = contextMeterOf(usage);
  if (reading.level === 'none') {
    return (
      <span data-testid="context-meter" data-level="none" className="inline-flex items-center gap-1.5 text-xs text-ink-400">
        <Gauge size={14} aria-hidden />
        {t('context.noData')}
      </span>
    );
  }
  const left = Math.max(0, 100 - reading.percent);
  const label = t('context.reading', { percent: reading.percent, used: formatTokens(reading.usedTokens), max: formatTokens(reading.maxTokens) });
  return (
    <div data-testid="context-meter" data-level={reading.level} className="inline-flex flex-wrap items-center gap-2 text-xs text-ink-300">
      <Gauge size={14} aria-hidden />
      <div
        role="progressbar"
        aria-label={t('context.label')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={reading.percent}
        aria-valuetext={label}
        className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-800"
      >
        <div className={`h-full ${BAR[reading.level]}`} style={{ width: `${reading.percent}%` }} />
      </div>
      <span data-testid="context-meter-text">{label}</span>
      {reading.level !== 'ok' && (
        <span role="status" data-testid="context-meter-warning" className={reading.level === 'critical' ? 'text-roseish' : 'text-amberish'}>
          {t(reading.level === 'critical' ? 'context.critical' : 'context.warn', { left })}
        </span>
      )}
      {reading.level !== 'ok' && onNewConversation && (
        <button
          type="button"
          onClick={onNewConversation}
          className="inline-flex items-center gap-1 rounded-md border border-ink-700 px-2 py-0.5 hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        >
          <MessageSquarePlus size={12} aria-hidden />
          {t('context.newConversation')}
        </button>
      )}
    </div>
  );
}
