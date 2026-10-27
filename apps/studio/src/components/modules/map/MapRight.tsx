'use client';

import { SegmentedControl, segmentedControlPanelId, segmentedControlTabId } from '@e-burgos/tucu-ui';
import { Users } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { RightPanelFrame } from '../../shell/RightPanelFrame';
import { AgentCard } from '../agents/AgentCard';
import { SwarmInteraction } from './SwarmInteraction';
import { SwarmScopeGuard, useSwarmPlayback } from './swarm-playback';

type MapTab = 'swarm' | 'agent';

function MapRightContent() {
  const { t } = useT();
  const baseId = useId();
  const agentId = useNav((s) => s.selection.agents);
  const select = useNav((s) => s.select);
  const { view } = useSwarmPlayback();
  const [chosen, setChosen] = useState<MapTab>('swarm');

  useEffect(() => {
    setChosen(agentId === null ? 'swarm' : 'agent');
  }, [agentId]);

  const tab: MapTab = agentId === null ? 'swarm' : chosen;
  const selectAgent = (id: string) => select('agents', id);

  return (
    <RightPanelFrame title={t('module.map.right.title')}>
      <div className="flex flex-col gap-3">
        <SegmentedControl<MapTab>
          semantics="tabs"
          idBase={baseId}
          size="sm"
          fullWidth
          data-studio-exempt="hosted-component"
          aria-label={t('module.map.tabs')}
          value={tab}
          onChange={setChosen}
          options={[
            { value: 'swarm', label: t('module.map.tab.swarm'), labelClassName: 'text-ui' },
            { value: 'agent', label: agentId === null ? t('ui.inspector.agent') : agentMeta(agentId).name, labelClassName: 'text-ui', disabled: agentId === null },
          ]}
        />
        <div role="tabpanel" id={segmentedControlPanelId(baseId, tab)} aria-labelledby={segmentedControlTabId(baseId, tab)} className="flex flex-col gap-3">
          {tab === 'swarm' || agentId === null ? (
            <>
              <SwarmInteraction onSelectAgent={selectAgent} />
              {agentId === null && (
                <p data-testid="map-select-hint" className="flex items-start gap-2 border-t border-foreground/10 pt-3 text-ui text-ink-300">
                  <Users aria-hidden size={16} className="mt-0.5 shrink-0 text-ink-400" />
                  <span>{t('module.map.swarm.hint')}</span>
                </p>
              )}
            </>
          ) : (
            <>
              <AgentCard key={agentId} agentId={agentId} conversation={view} showChat={false} />
              <div className="border-t border-foreground/10 pt-3">
                <SwarmInteraction key={agentId} agentId={agentId} onSelectAgent={selectAgent} />
              </div>
            </>
          )}
        </div>
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
