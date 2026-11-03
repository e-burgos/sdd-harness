'use client';

import { Button } from '@e-burgos/tucu-ui';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { useStudio } from '../../BridgeProvider';
import { MAP_AGENT_IDS } from '../../mission-control/AgentMapCanvas';
import { AgentDirectChat } from '../agents/AgentDirectChat';
import { AgentFaceChip } from '../agents/AgentFaceChip';
import { presenceOfAgent } from '../agents/agent-presence';
import { useMapChatState } from './map-chat-state';

export function MapAgentChat() {
  const { t } = useT();
  const agentId = useNav((s) => s.selection.agents);
  const state = useStudio((s) => (agentId ? (presenceOfAgent(s.presence, agentId)?.state ?? 'idle') : 'idle'));
  const expanded = useMapChatState((s) => s.expanded);
  const setExpanded = useMapChatState((s) => s.setExpanded);
  const open = useMapChatState((s) => s.open);
  const closeChat = useMapChatState((s) => s.closeChat);
  const inSnapshot = useStudio((s) => (agentId ? s.snapshot?.agents.some((agent) => agent.id === agentId) === true : false));
  if (agentId === null || !open) return null;
  const meta = agentMeta(agentId);
  const available = inSnapshot || MAP_AGENT_IDS.includes(agentId);

  return (
    <div className="pointer-events-none absolute bottom-4 left-64 right-6 top-[55%] z-30 flex items-end justify-center">
      <section
        data-testid="map-agent-chat"
        data-agent={agentId}
        aria-label={t('module.map.chat.title', { name: meta.name })}
        data-expanded={expanded}
        className={`pointer-events-auto flex ${expanded ? 'h-[22rem]' : 'h-[11.5rem]'} max-h-full min-h-0 w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-foreground/15 bg-ink-950/90 shadow-2xl backdrop-blur-xl`}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-foreground/10 px-3 py-2">
          <AgentFaceChip agent={agentId} size={28} state={state} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-ui font-semibold text-ink-100">{meta.name}</h3>
            <p className="truncate text-micro text-ink-400">{meta.role}</p>
          </div>
          <Button
            type="button"
            variant="transparent"
            color="gray"
            shape="circle"
            size="tiny"
            aria-label={t(expanded ? 'module.map.chat.collapse' : 'module.map.chat.expand')}
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown aria-hidden size={16} /> : <ChevronUp aria-hidden size={16} />}
          </Button>
          <Button type="button" variant="transparent" color="gray" shape="circle" size="tiny" aria-label={t('module.map.chat.close')} onClick={closeChat}>
            <X aria-hidden size={16} />
          </Button>
        </header>
        <AgentDirectChat agentId={agentId} floating disabledReason={available ? undefined : t('module.agents.chat.unavailable')} />
      </section>
    </div>
  );
}
