'use client';

import type { FixSummary } from '@sdd-studio/protocol';
import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { ROW_ICON } from '@/lib/typography-tokens';
import { ArrowUpRight } from 'lucide-react';
import { FixStatusBadge, SeverityChip } from './FixBadges';
import { formatFixDate } from './fix-date';
import { focusRing } from '../../shell/shell-context';

export function FixFacts({ fix, specAvailable, layout }: { fix: FixSummary; specAvailable: boolean; layout: 'grid' | 'stack' }) {
  const { t, lang } = useT();
  const open = useNav((s) => s.open);
  const noDate = t('fixes.card.noDate');
  const spec =
    fix.specId === null ? (
      <span className="text-ink-400">{t('fixes.card.noSpec')}</span>
    ) : specAvailable ? (
      <button
        type="button"
        aria-label={t('fixes.card.openSpec', { id: fix.specId })}
        onClick={() => open('specs', fix.specId)}
        className={`${focusRing} inline-flex max-w-full items-center gap-1 rounded-md text-left text-copy text-accent-400 hover:underline`}
      >
        <span className="min-w-0 truncate">{fix.specId}</span>
        <ArrowUpRight aria-hidden size={ROW_ICON} className="shrink-0" />
      </button>
    ) : (
      <span className="text-ink-400">{t('fixes.card.specUnavailable', { id: fix.specId })}</span>
    );
  const rows: [string, ReactNode][] = [
    [t('fixes.card.id'), <span key="id" className="break-all font-mono text-small">{fix.id}</span>],
    [t('fixes.card.status'), <FixStatusBadge key="status" status={fix.status} />],
    [t('fixes.card.severity'), <SeverityChip key="severity" severity={fix.severity} />],
    [t('fixes.card.spec'), spec],
    [t('fixes.card.created'), formatFixDate(fix.createdAt, lang) ?? noDate],
    [t('fixes.card.closed'), formatFixDate(fix.closedAt, lang) ?? noDate],
  ];
  return (
    <dl className={layout === 'grid' ? 'grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-x-6 gap-y-3' : 'flex flex-col gap-3'}>
      {rows.map(([term, value]) => (
        <div key={term} className="flex min-w-0 flex-col gap-1">
          <dt className="text-meta text-ink-400">{term}</dt>
          <dd className="min-w-0 text-copy text-ink-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
