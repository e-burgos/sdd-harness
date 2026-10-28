'use client';

import { EmptyState, ErrorState, SegmentedControl, StatCard } from '@e-burgos/tucu-ui';
import { Coins, Database, Hash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { agentMeta } from '@/lib/agents';
import { useT, type TFunction } from '@/lib/i18n/i18n';
import { useStudio } from '../../BridgeProvider';
import { PanelSkeleton } from '../../shell/PanelSkeleton';
import {
  agentKeyOf,
  aggregateUsage,
  ASSUMED_TIER,
  modelKeyOf,
  originKeyOf,
  parsePricing,
  totalsOf,
  UNKNOWN_KEY,
  type CostBucket,
  type PricingTable,
  type UsageRecord,
} from './costs-model';
import { percentOf } from './metrics-model';
import { Section, ShareRow, ViewFrame } from './MetricsParts';
import { RtkSavings } from './RtkSavings';
import { useCycleRecords } from './use-cycle-records';

type CostsTab = 'agentic' | 'rtk';

function money(value: number, currency: string, lang: string): string {
  const options = { style: 'currency' as const, maximumFractionDigits: value < 1 ? 4 : 2 };
  try {
    return new Intl.NumberFormat(lang, { ...options, currency }).format(value);
  } catch {
    return new Intl.NumberFormat(lang, { ...options, currency: 'USD' }).format(value);
  }
}

function Buckets({ title, buckets, labelOf, pricing, lang, t }: { title: string; buckets: CostBucket[]; labelOf: (key: string) => string; pricing: PricingTable; lang: string; t: TFunction }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.cost, 0);
  const tokens = new Intl.NumberFormat(lang, { notation: 'compact' });
  return (
    <Section title={title} meta={buckets.length}>
      <div className="flex flex-col gap-3">
        {buckets.map((bucket) => (
          <ShareRow
            key={bucket.key}
            label={labelOf(bucket.key)}
            value={`${money(bucket.cost, pricing.currency, lang)}${bucket.assumed ? ' *' : ''}`}
            meta={t('metrics.costs.bucketMeta', { tokens: tokens.format(bucket.tokensIn + bucket.tokensOut), pct: percentOf(bucket.cost, total) })}
            pct={percentOf(bucket.cost, total)}
          />
        ))}
      </div>
    </Section>
  );
}

function AgenticCosts() {
  const { t, lang } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const state = useCycleRecords();
  const pricing = useMemo(() => parsePricing(snapshot?.pricing), [snapshot]);
  const records: UsageRecord[] = state.status === 'ready' ? state.records : [];
  const view = useMemo(() => {
    if (pricing === null || records.length === 0) return null;
    const byAgent = aggregateUsage(records, pricing, agentKeyOf);
    return { byAgent, byModel: aggregateUsage(records, pricing, modelKeyOf), byCycle: aggregateUsage(records, pricing, originKeyOf), totals: totalsOf(byAgent) };
  }, [records, pricing]);

  if (pricing === null) {
    return (
      <div className="flex items-center justify-center p-6">
        <EmptyState size="sm" title={t('metrics.costs.noPricingTitle')} description={t('metrics.costs.noPricingBody')} />
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="flex items-center justify-center p-6">
        <ErrorState size="sm" title={t('metrics.costs.errorTitle')} onRetry={state.retry} retryLabel={t('metrics.costs.retry')} />
      </div>
    );
  }
  if (state.status === 'loading') return <PanelSkeleton rows={5} />;
  if (view === null) {
    return (
      <div className="flex items-center justify-center p-6">
        <EmptyState size="sm" title={t('metrics.costs.noUsageTitle')} description={t('metrics.costs.noUsageBody')} />
      </div>
    );
  }
  const count = new Intl.NumberFormat(lang);
  const unknown = t('metrics.costs.unknown');
  const agentLabel = (key: string) => (key === UNKNOWN_KEY ? unknown : agentMeta(key).name);
  const modelLabel = (key: string) => (key === UNKNOWN_KEY ? unknown : key);
  const assumed = view.byModel.some((bucket) => bucket.assumed) || view.byAgent.some((bucket) => bucket.assumed);
  return (
    <div data-costs-agentic className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard title={t('metrics.costs.total')} value={money(view.totals.cost, pricing.currency, lang)} subtitle={t('metrics.costs.totalSub', { currency: pricing.currency })} icon={<Coins size={16} />} tone="success" />
        <StatCard
          title={t('metrics.costs.tokens')}
          value={count.format(view.totals.tokensIn + view.totals.tokensOut)}
          subtitle={t('metrics.costs.tokensSub', { input: count.format(view.totals.tokensIn), output: count.format(view.totals.tokensOut) })}
          icon={<Hash size={16} />}
          tone="info"
        />
        <StatCard title={t('metrics.costs.records')} value={count.format(view.totals.units)} subtitle={t('metrics.costs.recordsSub', { approx: count.format(view.totals.approxUnits) })} icon={<Database size={16} />} tone="neutral" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Buckets title={t('metrics.costs.byAgent')} buckets={view.byAgent} labelOf={agentLabel} pricing={pricing} lang={lang} t={t} />
        <Buckets title={t('metrics.costs.byModel')} buckets={view.byModel} labelOf={modelLabel} pricing={pricing} lang={lang} t={t} />
      </div>
      <Buckets title={t('metrics.costs.byCycle')} buckets={view.byCycle} labelOf={(key) => key} pricing={pricing} lang={lang} t={t} />
      {assumed && <p className="text-meta text-ink-400">{t('metrics.costs.assumedNote', { tier: ASSUMED_TIER })}</p>}
    </div>
  );
}

export function CostsView() {
  const { t } = useT();
  const [tab, setTab] = useState<CostsTab>('agentic');
  return (
    <ViewFrame
      title={t('metrics.view.costs')}
      description={t('metrics.costs.description')}
      actions={
        <SegmentedControl
          size="sm"
          aria-label={t('metrics.costs.tabs')}
          semantics="tabs"
          value={tab}
          onChange={(next: CostsTab) => setTab(next)}
          options={[
            { value: 'agentic', label: t('metrics.costs.tab.agentic') },
            { value: 'rtk', label: t('metrics.costs.tab.rtk') },
          ]}
        />
      }
    >
      {tab === 'agentic' ? <AgenticCosts /> : <RtkSavings />}
    </ViewFrame>
  );
}
