'use client';

import { useNav } from '@/lib/nav/use-nav';
import { EcosystemDashboard } from '../../mission-control/EcosystemDashboard';
import { LiveTelemetryHUD } from '../../mission-control/LiveTelemetryHUD';
import { CostsView } from './CostsView';
import { MetricsDashboard } from './MetricsDashboard';
import { PlanningView } from './PlanningView';

export function MetricsCenter() {
  const view = useNav((s) => s.selection.metrics) ?? 'dashboard';
  switch (view) {
    case 'planning':
      return <PlanningView />;
    case 'costs':
      return <CostsView />;
    case 'ecosystem':
      return <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden"><EcosystemDashboard /></div>;
    case 'telemetry':
      return <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden"><LiveTelemetryHUD /></div>;
    default:
      return <MetricsDashboard />;
  }
}
