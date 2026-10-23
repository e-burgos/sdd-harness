'use client';

import { ShieldWarning } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import type { AlwaysOffer, AlwaysRule } from '@sdd-studio/protocol';
import type { TFunction } from '@/lib/i18n/i18n';
import type { TimelineItem } from '@/lib/store/timeline';

type Approval = Extract<TimelineItem, { kind: 'approval' }>;
const UNLOCK_MS = 20_000;
export const SUMMARY_CLAMP_CHARS = 240;
export const describeAlwaysRule = (rule: AlwaysRule, t: TFunction): string =>
  rule.kind === 'tool'
    ? t('approval.always.tool', { tool: rule.tool })
    : rule.kind === 'mcp'
      ? t('approval.always.mcp', { tool: rule.tool })
      : t('approval.always.bash', { prefix: rule.prefix });

const noRuleReason = (offer: Extract<AlwaysOffer, { kind: 'none' }>) =>
  offer.reason === 'gate-warning' ? 'approval.always.none.gate' : 'approval.always.none.uncalculable';

export type RespondFn = (decision: 'allow' | 'deny', scope: 'once' | 'thread', reason?: string) => Promise<unknown>;

export function ApprovalCard({ item, onRespond }: { item: Approval; onRespond: RespondFn }) {
  const { t } = useT();
  const [reason, setReason] = useState('');
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const longSummary = item.summary.length > SUMMARY_CLAMP_CHARS;
  const pending = item.decision === 'pending';
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    inFlight.current = false;
    setSending(false);
    setError(null);
  }, [item.decision]);
  // Response accepted but the decision never arrived: unlock without error after 20 s.
  useEffect(() => {
    if (!sending || !pending) return;
    const timer = setTimeout(() => {
      inFlight.current = false;
      setSending(false);
    }, UNLOCK_MS);
    return () => clearTimeout(timer);
  }, [sending, pending]);
  const send: RespondFn = async (...args) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    try {
      await onRespond(...args);
    } catch (e) {
      inFlight.current = false;
      setSending(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const offer = item.always;
  const rule = offer && offer.kind !== 'none' ? offer : null;
  const ruleHintId = `always-${item.id}`;
  const deny = () => void send('deny', 'once', reason.trim() || undefined);
  const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-50';
  return (
    <div className={`min-w-0 rounded-xl border p-4 ${pending ? 'border-amberish/50 bg-amberish/5' : 'border-ink-700 bg-ink-900'}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <ShieldWarning size={18} className="text-amberish" />
        {t('approval.title', { name: agentMeta(item.author.agent).name, tool: item.tool })}
      </div>
      <code
        data-testid="approval-summary"
        className={`block break-all rounded-md bg-ink-950 p-2 font-mono text-xs text-ink-100 ${longSummary && !summaryExpanded ? 'line-clamp-3' : 'max-h-48 overflow-auto'}`}
      >
        {item.summary}
      </code>
      {longSummary && (
        <button type="button" aria-expanded={summaryExpanded} className="mt-1 text-xs text-ink-300 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400" onClick={() => setSummaryExpanded((v) => !v)}>
          {summaryExpanded ? t('approval.summary.less') : t('approval.summary.more')}
        </button>
      )}
      {item.gateWarning && <p className="mt-2 rounded-md bg-roseish/10 p-2 text-xs text-roseish">{item.gateWarning}</p>}
      {item.diff && (
        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-ink-950 p-2 font-mono text-[11px] leading-snug">{item.diff}</pre>
      )}
      {item.input && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-ink-300">{t('approval.input')}</summary>
          {item.inputTruncated && <p className="mt-1 text-xs text-amberish">{t('approval.truncated')}</p>}
          <pre data-testid="approval-input" className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-ink-950 p-2 font-mono text-[11px]">
            {item.input}
          </pre>
        </details>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-roseish">{error}</p>
      )}
      {pending && rule && (
        <p id={ruleHintId} data-testid="always-scope" className="mt-3 text-xs text-ink-300">
          {t('approval.always.scope', { rule: describeAlwaysRule(rule, t) })}
        </p>
      )}
      {pending && offer?.kind === 'none' && (
        <p data-testid="always-unavailable" className="mt-3 text-xs text-ink-300">{t(noRuleReason(offer))}</p>
      )}
      {pending ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button className={`rounded-md bg-accent-500 ${ring} px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-accent-400`} disabled={sending} onClick={() => void send('allow', 'once', undefined)}>
              {t('approval.allow')}
            </button>
            {rule && (
              <button
                className={`rounded-md border border-ink-700 px-3 py-1.5 text-sm hover:bg-ink-800 ${ring}`}
                aria-describedby={ruleHintId}
                disabled={sending}
                onClick={() => void send('allow', 'thread', undefined)}
              >
                {t('approval.always')}
              </button>
            )}
            <button
              className={`ml-auto rounded-md border border-roseish/50 px-3 py-1.5 text-sm text-roseish hover:bg-roseish/10 ${ring}`}
              disabled={sending} onClick={deny}
            >
              {t('approval.deny')}
            </button>
          </div>
          <input
            className={`block w-full min-w-0 rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-sm ${ring}`}
            placeholder={t('approval.reason')}
            value={reason}
            maxLength={2000}
            aria-label={t('approval.reason')}
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) deny();
            }}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      ) : (
        <p className={`mt-3 text-xs ${item.decision === 'allow' ? 'text-accent-300' : 'text-roseish'}`}>
          {item.decision === 'allow' ? t('approval.allowed') : t('approval.denied')}
          {item.reason ? ` — ${item.reason}` : ''}
          {item.remembered && <span data-testid="always-remembered">{` — ${t('approval.remembered', { rule: describeAlwaysRule(item.remembered, t) })}`}</span>}
        </p>
      )}
    </div>
  );
}
