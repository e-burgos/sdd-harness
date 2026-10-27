'use client';

import { useT } from '@/lib/i18n/i18n';
import { ModulePanel } from '../../shell/ModulePanel';
import { PanelNotice } from '../../shell/PanelNotice';

export function ActivityPanel() {
  const { t } = useT();
  return (
    <ModulePanel moduleId="activity" searchable={false}>
      <PanelNotice message={t('shell.stub.title')} />
    </ModulePanel>
  );
}
