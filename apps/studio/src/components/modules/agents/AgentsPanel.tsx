'use client';

import type { AgentSummary } from '@sdd-studio/protocol';
import { useMemo } from 'react';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { matchesQuery } from '@/lib/nav/search';
import { useNav } from '@/lib/nav/use-nav';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { useStudio } from '../../BridgeProvider';
import { ModulePanel } from '../../shell/ModulePanel';
import { PanelGroup } from '../../shell/PanelGroup';
import { PanelNotice } from '../../shell/PanelNotice';
import { PanelRow } from '../../shell/PanelRow';
import { AgentFaceChip } from './AgentFaceChip';
import { presenceOfAgent } from './agent-presence';

export function AgentsPanel() {
  const { t } = useT();
  const agents = useStudio((s) => s.snapshot?.agents ?? null);
  const presence = useStudio((s) => s.presence);
  const selected = useNav((s) => s.selection.agents);
  const select = useNav((s) => s.select);
  const [query] = useModuleQuery('agents');

  const shown = useMemo(
    () => (agents ?? []).filter((agent) => matchesQuery(query, agentMeta(agent.id).name, agent.id, agent.description, agent.model)),
    [agents, query],
  );
  const groups = [
    { id: 'project', title: t('module.agents.group.project'), items: shown.filter((agent) => agent.source === 'claude') },
    { id: 'kit', title: t('module.agents.group.kit'), items: shown.filter((agent) => agent.source === 'sdd') },
  ].filter((group) => group.items.length > 0);

  const row = (agent: AgentSummary) => {
    const state = presenceOfAgent(presence, agent.id)?.state ?? 'idle';
    return (
      <PanelRow
        key={agent.id}
        label={agentMeta(agent.id).name}
        title={agent.description || agent.id}
        leading={<AgentFaceChip agent={agent.id} state={state} size={16} />}
        meta={agent.model ?? undefined}
        selected={selected === agent.id}
        onClick={() => select('agents', agent.id)}
      />
    );
  };

  return (
    <ModulePanel moduleId="agents" status={agents === null ? 'loading' : 'ready'} hasResults={shown.length > 0}>
      {agents !== null && agents.length === 0 ? (
        <PanelNotice message={t('module.agents.empty')} />
      ) : (
        groups.map((group) => (
          <PanelGroup key={group.id} id={group.id} title={group.title} count={group.items.length}>
            {group.items.map(row)}
          </PanelGroup>
        ))
      )}
    </ModulePanel>
  );
}
