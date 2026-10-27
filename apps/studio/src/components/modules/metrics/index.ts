import type { ModuleSlots } from '@/lib/nav/module-slots';
import { MetricsCenter } from './MetricsCenter';
import { MetricsPanel } from './MetricsPanel';

export const metricsModule: ModuleSlots = { Panel: MetricsPanel, Center: MetricsCenter, Right: null, legacyCenter: true };
