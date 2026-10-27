'use client';

import { SegmentedControl } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { EcosystemDashboard } from '../../mission-control/EcosystemDashboard';
import { LiveTelemetryHUD } from '../../mission-control/LiveTelemetryHUD';

type LegacyMetricsView = 'ecosystem' | 'telemetry';

export function MetricsCenter() {
  const { t } = useT();
  const selected = useNav((s) => s.selection.metrics);
  const select = useNav((s) => s.select);
  const view: LegacyMetricsView = selected === 'telemetry' ? 'telemetry' : 'ecosystem';
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 justify-center border-b border-foreground/10 p-2">
        <SegmentedControl
          size="sm"
          aria-label={t('shell.stub.metrics.views')}
          value={view}
          onChange={(next: LegacyMetricsView) => select('metrics', next)}
          options={[
            { value: 'ecosystem', label: t('shell.stub.metrics.ecosystem') },
            { value: 'telemetry', label: t('shell.stub.metrics.telemetry') },
          ]}
        />
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">{view === 'telemetry' ? <LiveTelemetryHUD /> : <EcosystemDashboard />}</div>
    </div>
  );
}
