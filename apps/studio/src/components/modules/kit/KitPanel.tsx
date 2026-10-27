'use client';

import { useT } from '@/lib/i18n/i18n';
import { ModulePanel } from '../../shell/ModulePanel';
import { PanelNotice } from '../../shell/PanelNotice';

export function KitPanel() {
  const { t } = useT();
  return (
    <ModulePanel moduleId="kit" searchable={false}>
      <PanelNotice message={t('shell.stub.title')} />
    </ModulePanel>
  );
}
