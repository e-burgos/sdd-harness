'use client';

import { Users } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { PanelNotice } from '../../shell/PanelNotice';
import { RightPanelFrame } from '../../shell/RightPanelFrame';
import { AgentCard } from './AgentCard';

export function AgentsRight() {
  const { t } = useT();
  const agentId = useNav((s) => s.selection.agents);
  return (
    <RightPanelFrame title={t('module.agents.right.title')}>
      {agentId === null ? <PanelNotice message={t('module.agents.right.empty')} icon={Users} /> : <AgentCard key={agentId} agentId={agentId} />}
    </RightPanelFrame>
  );
}
