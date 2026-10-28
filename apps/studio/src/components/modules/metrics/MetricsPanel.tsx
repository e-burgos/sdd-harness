'use client';

import { BarChart3, Boxes, Coins, Activity, ListTree } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import { METRICS_VIEWS, useNav, type MetricsView } from '@/lib/nav/use-nav';
import { SectionListPanel, type PanelSection } from '../../shell/SectionListPanel';

const VIEW_ICONS = { dashboard: BarChart3, planning: ListTree, costs: Coins, ecosystem: Boxes, telemetry: Activity } as const;

export function MetricsPanel() {
  const { t } = useT();
  const selected = useNav((s) => s.selection.metrics) ?? 'dashboard';
  const select = useNav((s) => s.select);
  const sections: PanelSection<MetricsView>[] = METRICS_VIEWS.map((id) => ({ id, label: t(`metrics.view.${id}`), icon: VIEW_ICONS[id] }));
  return <SectionListPanel moduleId="metrics" groupTitle={t('metrics.panel.group')} sections={sections} selected={selected} onSelect={(id) => select('metrics', id)} />;
}
