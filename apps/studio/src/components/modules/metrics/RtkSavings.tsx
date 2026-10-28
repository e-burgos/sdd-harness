'use client';

import { Button, EmptyState, ErrorState, StatCard } from '@e-burgos/tucu-ui';
import { Gauge, Terminal, TrendingDown, Wallet } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import { useStudio } from '../../BridgeProvider';
import { ASSUMED_TIER, parsePricing, rtkCommandsOf, rtkEquivalentUsd, rtkSummaryOf } from './costs-model';
import { Section, ShareRow } from './MetricsParts';
import { useRtkGain } from './use-rtk-gain';
import { PanelSkeleton } from '../../shell/PanelSkeleton';

function money(value: number, currency: string, lang: string): string {
  try {
    return new Intl.NumberFormat(lang, { style: 'currency', currency }).format(value);
  } catch {
    return new Intl.NumberFormat(lang, { style: 'currency', currency: 'USD' }).format(value);
  }
}

function Notice({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center justify-center p-6">
      <EmptyState size="sm" title={title} description={description} />
    </div>
  );
}

export function RtkSavings() {
  const { t, lang } = useT();
  const { state, reload } = useRtkGain();
  const snapshot = useStudio((s) => s.snapshot);
  const pricing = parsePricing(snapshot?.pricing);
  const number = new Intl.NumberFormat(lang);

  if (state.status === 'unsupported') return <Notice title={t('metrics.rtk.unsupportedTitle')} description={t('metrics.rtk.unsupportedBody')} />;
  if (state.status === 'offline') return <Notice title={t('metrics.rtk.offlineTitle')} description={t('metrics.rtk.offlineBody')} />;
  if (state.status === 'loading') return <PanelSkeleton rows={4} />;
  if (state.status === 'failed') {
    return (
      <div className="flex items-center justify-center p-6">
        <ErrorState size="sm" title={t('metrics.rtk.errorTitle')} onRetry={reload} retryLabel={t('metrics.rtk.retry')} />
      </div>
    );
  }
  const { gain } = state;
  if (gain.status === 'not-installed') return <Notice title={t('metrics.rtk.notInstalledTitle')} description={t('metrics.rtk.notInstalledBody')} />;
  if (gain.status === 'error') {
    return (
      <div className="flex items-center justify-center p-6">
        <ErrorState size="sm" title={t('metrics.rtk.errorTitle')} onRetry={reload} retryLabel={t('metrics.rtk.retry')} />
      </div>
    );
  }
  const summary = rtkSummaryOf(gain.gain);
  if (summary === null || summary.commands === 0) return <Notice title={t('metrics.rtk.noDataTitle')} description={t('metrics.rtk.noDataBody')} />;
  const usd = rtkEquivalentUsd(summary.saved, pricing);
  const commands = rtkCommandsOf(gain.gain);
  const topSaved = commands[0]?.saved ?? 0;
  const readAt = new Date(gain.readAt);
  const readLabel = Number.isNaN(readAt.getTime()) ? gain.readAt : readAt.toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' });
  return (
    <div data-rtk-savings className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-small text-ink-400">{t('metrics.rtk.description')}</p>
        <Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" onClick={reload}>
          {t('metrics.rtk.refresh')}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={t('metrics.rtk.commands')} value={number.format(summary.commands)} icon={<Terminal size={16} />} tone="neutral" />
        <StatCard title={t('metrics.rtk.read')} value={number.format(summary.output)} icon={<Gauge size={16} />} tone="info" />
        <StatCard
          title={t('metrics.rtk.saved')}
          value={number.format(summary.saved)}
          subtitle={summary.avgSavingsPct === null ? undefined : t('metrics.rtk.savedSub', { pct: Math.round(summary.avgSavingsPct) })}
          icon={<TrendingDown size={16} />}
          tone="success"
        />
        {usd !== null && pricing !== null && (
          <StatCard title={t('metrics.rtk.usd')} value={money(usd, pricing.currency, lang)} subtitle={t('metrics.rtk.usdSub', { tier: ASSUMED_TIER })} icon={<Wallet size={16} />} tone="brand" />
        )}
      </div>
      {commands.length > 0 && (
        <Section title={t('metrics.rtk.byCommand')} meta={commands.length}>
          <div className="flex flex-col gap-3">
            {commands.map((row) => (
              <ShareRow
                key={row.command}
                label={row.command}
                value={number.format(row.saved)}
                meta={t('metrics.rtk.byCommandMeta', { saved: number.format(row.saved), commands: number.format(row.commands) })}
                pct={topSaved === 0 ? 0 : Math.max(1, Math.round((row.saved / topSaved) * 100))}
              />
            ))}
          </div>
        </Section>
      )}
      <p className="text-meta text-ink-400">{t('metrics.rtk.footnote', { version: gain.version ?? '?', at: readLabel })}</p>
    </div>
  );
}
