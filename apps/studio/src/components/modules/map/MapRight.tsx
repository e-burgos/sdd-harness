'use client';

import { Users } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { RightPanelFrame } from '../../shell/RightPanelFrame';
import { AgentCard } from '../agents/AgentCard';
import { SwarmInteraction } from './SwarmInteraction';
import { SwarmScopeGuard, useSwarmPlayback } from './swarm-playback';

function MapRightContent() {
  const { t } = useT();
  const agentId = useNav((s) => s.selection.agents);
  const select = useNav((s) => s.select);
  const { view } = useSwarmPlayback();
  return (
    <RightPanelFrame title={t('module.map.right.title')}>
      <div className="flex flex-col gap-3">
        <SwarmInteraction onSelectAgent={(id) => select('agents', id)} />
        {agentId === null ? (
          <p data-testid="map-select-hint" className="flex items-start gap-2 border-t border-foreground/10 pt-3 text-ui text-ink-300">
            <Users aria-hidden size={16} className="mt-0.5 shrink-0 text-ink-400" />
            <span>{t('module.map.swarm.hint')}</span>
          </p>
        ) : (
          <div className="border-t border-foreground/10 pt-3">
            <AgentCard key={agentId} agentId={agentId} conversation={view} />
          </div>
        )}
      </div>
    </RightPanelFrame>
  );
}

export function MapRight() {
  return (
    <SwarmScopeGuard>
      <MapRightContent />
    </SwarmScopeGuard>
  );
}
