'use client';

import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { RightPanelFrame } from '../../shell/RightPanelFrame';
import { AgentInspectorDrawer } from '../../mission-control/AgentInspectorDrawer';
import { useMapChatState } from './map-chat-state';
import { SwarmScopeGuard, useSwarmPlayback } from './swarm-playback';

function MapRightContent() {
  const { t } = useT();
  const agentId = useNav((s) => s.selection.agents);
  const select = useNav((s) => s.select);
  const openChat = useMapChatState((s) => s.openChat);
  const { view, pick, conversationPresence, currentDialogue, inspect } = useSwarmPlayback();
  const presence = agentId ? conversationPresence.find((p) => p.agent === agentId) : undefined;

  return (
    <RightPanelFrame title={t('module.map.right.title')}>
      <AgentInspectorDrawer
        embedded
        agentId={agentId}
        presence={presence}
        conversation={view}
        currentDialogueId={currentDialogue?.id}
        onPickConversation={pick}
        onSelectAgent={(id) => select('agents', id)}
        onSelectDialogue={inspect}
        onOpenDm={(id) => {
          select('agents', id);
          openChat();
        }}
      />
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
