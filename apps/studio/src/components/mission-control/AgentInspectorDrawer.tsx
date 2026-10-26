'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageSquare, Moon, User, Users, X, Zap } from 'lucide-react';
import type { Presence } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { documentsOfAgent, relatedFromDocuments, type ConversationDialogue, type ConversationView } from '@/lib/conversation';
import { useT } from '@/lib/i18n/i18n';
import { useCollapsedState } from '@/lib/use-collapsed-state';
import { AgentAvatar } from '../workspace/AgentAvatar';
import { useStudio } from '../BridgeProvider';
import { ChatDialogueCard } from './ChatDialogueCard';
import { ConversationSessionInfo } from './ConversationSessionInfo';
import { LiveAgentChatFeed } from './LiveAgentChatFeed';
import { RelatedDocuments } from './RelatedDocuments';

interface AgentInspectorDrawerProps {
  agentId: string | null;
  presence?: Presence;
  conversation: ConversationView | null;
  currentDialogueId?: string | null;
  onPickConversation?: (threadId: string) => void;
  onSelectAgent?: (agentId: string) => void;
  onSelectDialogue?: (dialogue: ConversationDialogue) => void;
  onClose: () => void;
  onOpenDm: (agentId: string) => void;
}

const PAGE_SIZE = 50;
const AGENT_INFO_NODE = 'mission-control.agent-info';

const displayName = (id: string): string => (id === 'user' ? 'Tú' : agentMeta(id).name);

export function AgentInspectorDrawer({
  agentId,
  presence,
  conversation,
  currentDialogueId,
  onPickConversation,
  onSelectAgent,
  onSelectDialogue,
  onClose,
  onOpenDm,
}: AgentInspectorDrawerProps) {
  const { t } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const [activeTab, setActiveTab] = useState<'agent' | 'swarm'>(() => (agentId ? 'agent' : 'swarm'));
  const collapsed = useCollapsedState(snapshot?.project ?? '');
  const showFullProfile = !collapsed.isCollapsed(AGENT_INFO_NODE, true);
  const toggleAgentInfo = () => collapsed.toggle(AGENT_INFO_NODE, true);
  const [swarmLimit, setSwarmLimit] = useState(PAGE_SIZE);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });

  useEffect(() => {
    setActiveTab(agentId ? 'agent' : 'swarm');
  }, [agentId]);

  useEffect(() => {
    if (activeTab !== 'swarm') return;
    const timer = setTimeout(scrollToBottom, 60);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const meta = agentId ? agentMeta(agentId) : null;
  const state = presence?.state ?? 'idle';
  const displayedDialogues = useMemo(() => (conversation?.dialogues ?? []).slice(-swarmLimit), [conversation, swarmLimit]);

  const scopedToAgent = activeTab === 'agent' && agentId !== null;
  const shownDocuments = useMemo(
    () => (!conversation ? [] : scopedToAgent ? documentsOfAgent(conversation.documents, agentId) : conversation.documents),
    [conversation, scopedToAgent, agentId],
  );
  const shownRelated = useMemo(() => relatedFromDocuments(shownDocuments), [shownDocuments]);

  const sessionAndDocuments = conversation && (
    <div className="space-y-2">
      <ConversationSessionInfo engineSessionId={conversation.engineSessionId} provider={conversation.provider} />
      <RelatedDocuments
        specs={shownRelated.specs}
        fixes={shownRelated.fixes}
        documents={shownDocuments}
        emptyMessage={scopedToAgent ? t('mc.related.agentEmpty') : undefined}
        open={showFullProfile}
        onToggle={toggleAgentInfo}
      />
    </div>
  );

  return (
    <aside
      data-testid="agent-inspector-drawer"
      className="absolute top-4 right-4 bottom-4 w-96 lg:w-[420px] rounded-2xl border border-white/15 bg-ink-950/95 p-4 shadow-2xl backdrop-blur-xl flex flex-col z-20 animate-in fade-in slide-in-from-right duration-300 select-none overflow-hidden"
    >
      <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center bg-white/5 p-0.5 rounded-xl border border-white/10 text-xs font-mono">
          <button
            type="button"
            onClick={() => {
              setActiveTab('swarm');
              setTimeout(scrollToBottom, 60);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
              activeTab === 'swarm' ? 'bg-emerald-500 text-ink-950 font-bold shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Enjambre</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (agentId) setActiveTab('agent');
            }}
            disabled={!agentId}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
              activeTab === 'agent'
                ? 'bg-emerald-500 text-ink-950 font-bold shadow'
                : !agentId
                  ? 'text-white/30 cursor-not-allowed'
                  : 'text-white/60 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{meta ? meta.name : 'Agente'}</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {activeTab === 'agent' && meta && (
            <button
              type="button"
              onClick={toggleAgentInfo}
              className="rounded-lg px-2 py-1 text-[10px] font-mono text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              title="Alternar vista de perfil completo"
            >
              {showFullProfile ? t('map.hideInfo') : t('map.showInfo')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white transition-colors text-xs"
            title="Contraer panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {activeTab === 'agent' ? (
        meta && agentId ? (
          <>
            <div className="flex items-center gap-3 py-2.5 border-b border-white/10 shrink-0">
              <AgentAvatar agent={agentId} size={42} status={presence?.state === 'working' ? 'running' : null} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-sm text-white truncate">{meta.name}</h3>
                  {meta.isLeader && (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300 font-bold shrink-0">
                      LEADER
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-white/50 font-mono uppercase truncate">{meta.role}</p>
              </div>
            </div>

            <div className="py-2 shrink-0 space-y-1.5 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      state === 'working' ? 'bg-sky-400 animate-ping' : state === 'waiting' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  />
                  <span className="text-[11px] font-mono font-medium text-white capitalize">
                    {state === 'working' ? 'Ejecutando turno en vivo' : state === 'waiting' ? 'Esperando aprobación' : 'En espera (Ready)'}
                  </span>
                </div>
                <span className="text-[10px] text-white/40 font-mono truncate max-w-[160px]">{meta.title}</span>
              </div>

              {presence?.tool && (
                <div className="flex items-center gap-1.5 rounded-md bg-sky-950/40 border border-sky-500/30 px-2 py-1 font-mono text-[10px] text-sky-200 truncate">
                  <Zap className="w-3 h-3 text-sky-400 shrink-0" />
                  <span className="truncate">{presence.tool}</span>
                </div>
              )}

              {showFullProfile && (
                <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                  <p className="text-[11px] leading-relaxed text-white/70 bg-white/5 p-2.5 rounded-lg border border-white/5">
                    &ldquo;{meta.personality}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {sessionAndDocuments && <div className="py-2 border-b border-white/10 shrink-0 max-h-48 overflow-y-auto">{sessionAndDocuments}</div>}

            <div className="flex-1 min-h-0 py-2 flex flex-col">
              <LiveAgentChatFeed agentId={agentId} conversation={conversation} onPickConversation={onPickConversation} />
            </div>

            <div className="pt-2 border-t border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onOpenDm(agentId);
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-ink-950 py-2 px-3 font-semibold text-xs tracking-wide shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{t('map.openNewChat', { name: meta.name })}</span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white/50 space-y-3">
            <Users className="w-8 h-8 text-white/30" />
            <p className="text-xs font-semibold text-white/80">Ningún agente seleccionado</p>
            <p className="text-[11px] text-white/50 max-w-[260px] leading-relaxed">
              Haz clic en cualquiera de los nodos del mapa para inspeccionar a un agente y ver los documentos que generó.
            </p>
          </div>
        )
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {sessionAndDocuments && (
            <div className="p-2.5 bg-ink-900/70 border-b border-white/10 rounded-t-xl shrink-0 max-h-56 overflow-y-auto">{sessionAndDocuments}</div>
          )}

          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-white/5 shrink-0">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${displayedDialogues.some((d) => d.isLive) ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'}`}
              />
              <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
                Comms del Enjambre ({conversation?.dialogues.length ?? 0})
              </span>
            </div>
            <button
              type="button"
              onClick={scrollToBottom}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
              title="Bajar al último mensaje"
            >
              ↓ Abajo
            </button>
          </div>

          <div
            data-testid="swarm-comms-scroll"
            className="flex-1 overflow-y-auto p-2.5 space-y-2 text-xs select-text scroll-smooth bg-ink-900/40 rounded-b-xl border border-white/5"
          >
            {!conversation || conversation.isEmpty ? (
              <div data-testid="swarm-comms-empty-state" className="h-full flex flex-col items-center justify-center p-4 text-center text-white/50 space-y-2">
                <Moon className="w-8 h-8 text-white/30" />
                <p className="text-xs font-sans leading-relaxed">{conversation ? t('mc.noActivity') : t('mc.noConversations')}</p>
              </div>
            ) : (
              <>
                {conversation.dialogues.length > displayedDialogues.length && (
                  <div className="flex justify-center pb-1">
                    <button
                      type="button"
                      onClick={() => setSwarmLimit((v) => v + PAGE_SIZE)}
                      className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1 font-mono text-[10px] text-emerald-400 hover:text-emerald-300 transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <span>↑</span>
                      <span>Cargar mensajes anteriores (+{PAGE_SIZE})</span>
                    </button>
                  </div>
                )}

                {displayedDialogues.map((item) => {
                  const sender = agentMeta(item.from);
                  const receiver = item.to ? agentMeta(item.to) : null;
                  return (
                    <ChatDialogueCard
                      key={item.id}
                      id={item.id}
                      senderId={item.from}
                      senderName={displayName(item.from)}
                      senderColor={sender.color}
                      receiverId={item.to ?? undefined}
                      receiverName={item.to ? displayName(item.to) : undefined}
                      receiverColor={receiver?.color}
                      text={item.text}
                      gateId={item.gateId}
                      badge={item.isLive ? 'LIVE' : undefined}
                      isLive={item.isLive}
                      isCurrent={item.id === currentDialogueId}
                      seqNumber={item.seq}
                      provider={conversation.provider}
                      onClick={() => {
                        onSelectAgent?.(item.from);
                        onSelectDialogue?.(item);
                      }}
                    />
                  );
                })}

                <div ref={messagesEndRef} data-testid="swarm-messages-end" className="h-1" />
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
