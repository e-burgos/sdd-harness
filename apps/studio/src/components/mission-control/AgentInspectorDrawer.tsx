'use client';

import { Button, Tooltip } from '@e-burgos/tucu-ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageSquare, Moon, User, Users, X, Zap } from 'lucide-react';
import type { Presence } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { documentsOfAgent, relatedFromDocuments, type ConversationDialogue, type ConversationView } from '@/lib/conversation';
import { useT } from '@/lib/i18n/i18n';
import { useCollapsedState } from '@/lib/use-collapsed-state';
import { AgentAvatar } from '../workspace/AgentAvatar';
import { useStudio } from '../BridgeProvider';
import { SegmentedControl } from '../SegmentedControl';
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
  const displayName = (id: string): string => (id === 'user' ? t('ui.you') : agentMeta(id).name);
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
      <ConversationSessionInfo sessionTitle={conversation.sessionTitle} engineSessionId={conversation.engineSessionId} provider={conversation.provider} />
      <RelatedDocuments
        specs={shownRelated.specs}
        fixes={shownRelated.fixes}
        documents={shownDocuments}
        documentSource={conversation.documentSource}
        emptyMessage={scopedToAgent ? t('mc.related.agentEmpty') : undefined}
        open={showFullProfile}
        onToggle={toggleAgentInfo}
      />
    </div>
  );

  return (
    <aside
      data-testid="agent-inspector-drawer"
      className="absolute top-4 right-4 bottom-4 w-96 lg:w-[420px] rounded-2xl border border-foreground/15 bg-ink-950/95 p-4 shadow-2xl backdrop-blur-xl flex flex-col z-20 animate-in fade-in slide-in-from-right duration-300 select-none overflow-hidden"
    >
      <div className="flex items-center justify-between pb-3 border-b border-foreground/10 shrink-0">
        <SegmentedControl
          semantics="tabs"
          ariaLabel={t('segment.inspector')}
          className="font-mono"
          value={activeTab}
          onChange={(tab) => {
            if (tab === 'swarm') {
              setActiveTab('swarm');
              setTimeout(scrollToBottom, 60);
            } else if (agentId) setActiveTab('agent');
          }}
          options={[
            { id: 'swarm', label: t('ui.swarm'), icon: <Bot className="h-3.5 w-3.5" /> },
            { id: 'agent', label: meta ? meta.name : t('ui.inspector.agent'), icon: <User className="h-3.5 w-3.5" />, disabled: !agentId },
          ]}
        />

        <div className="flex items-center gap-1">
          {activeTab === 'agent' && meta && (
            <Tooltip lazy size="xs" arrow={false} content={t('ui.inspector.toggleProfile')}>
              <Button type="button" variant="transparent" color="gray" size="tiny" className="font-mono" onClick={toggleAgentInfo}>
                {showFullProfile ? t('map.hideInfo') : t('map.showInfo')}
              </Button>
            </Tooltip>
          )}
          <Tooltip lazy size="xs" arrow={false} content={t('ui.inspector.collapse')}>
            <Button type="button" variant="transparent" color="gray" shape="circle" size="tiny" onClick={onClose} aria-label={t('ui.inspector.collapse')}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {activeTab === 'agent' ? (
        meta && agentId ? (
          <>
            <div className="flex items-center gap-3 py-2.5 border-b border-foreground/10 shrink-0">
              <AgentAvatar agent={agentId} size={42} status={presence?.state === 'working' ? 'running' : null} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-sm text-ink-100 truncate">{meta.name}</h3>
                  {meta.isLeader && (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-micro text-emerald-300 font-bold shrink-0">
                      {t('ui.inspector.leaderBadge')}
                    </span>
                  )}
                </div>
                <p className="text-micro text-ink-500 font-mono uppercase truncate">{meta.role}</p>
              </div>
            </div>

            <div className="py-2 shrink-0 space-y-1.5 border-b border-foreground/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      state === 'working' ? 'bg-sky-400 animate-ping' : state === 'waiting' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  />
                  <span className="text-meta font-mono font-medium text-ink-100 capitalize">
                    {state === 'working' ? t('ui.inspector.stateWorking') : state === 'waiting' ? t('ui.inspector.stateWaiting') : t('ui.inspector.stateReady')}
                  </span>
                </div>
                <span className="text-micro text-ink-500 font-mono truncate max-w-[160px]">{meta.title}</span>
              </div>

              {presence?.tool && (
                <div className="flex items-center gap-1.5 rounded-md bg-sky-950/40 border border-sky-500/30 px-2 py-1 font-mono text-micro text-sky-200 truncate">
                  <Zap className="w-3 h-3 text-sky-400 shrink-0" />
                  <span className="truncate">{presence.tool}</span>
                </div>
              )}

              {showFullProfile && (
                <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                  <p className="text-meta leading-relaxed text-ink-300 bg-foreground/5 p-2.5 rounded-lg border border-foreground/5">
                    &ldquo;{meta.personality}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {sessionAndDocuments && <div className="py-2 border-b border-foreground/10 shrink-0 max-h-48 overflow-y-auto">{sessionAndDocuments}</div>}

            <div className="flex-1 min-h-0 py-2 flex flex-col">
              <LiveAgentChatFeed agentId={agentId} conversation={conversation} onPickConversation={onPickConversation} />
            </div>

            <div className="pt-2 border-t border-foreground/10 shrink-0">
              <Button
                type="button"
                fullWidth
                size="mini"
                onClick={() => {
                  onOpenDm(agentId);
                  onClose();
                }}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{t('map.openNewChat', { name: meta.name })}</span>
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-ink-500 space-y-3">
            <Users className="w-8 h-8 text-ink-500" />
            <p className="text-xs font-semibold text-ink-100">{t('ui.inspector.noAgent')}</p>
            <p className="text-meta text-ink-500 max-w-[260px] leading-relaxed">
              {t('ui.inspector.noAgentHint')}
            </p>
          </div>
        )
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {sessionAndDocuments && (
            <div className="p-2.5 bg-ink-900/70 border-b border-foreground/10 rounded-t-xl shrink-0 max-h-56 overflow-y-auto">{sessionAndDocuments}</div>
          )}

          <div className="flex items-center justify-between px-3 py-1.5 border-b border-foreground/10 bg-foreground/5 shrink-0">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${displayedDialogues.some((d) => d.isLive) ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'}`}
              />
              <span className="text-micro font-mono font-bold text-ink-100 uppercase tracking-wider">
                {t('ui.inspector.swarmComms', { n: conversation?.dialogues.length ?? 0 })}
              </span>
            </div>
            <Tooltip lazy size="xs" arrow={false} content={t('ui.inspector.scrollBottom')}>
              <Button type="button" variant="transparent" color="success" size="tiny" className="font-mono text-meta" onClick={scrollToBottom}>
                {t('ui.inspector.down')}
              </Button>
            </Tooltip>
          </div>

          <div
            data-testid="swarm-comms-scroll"
            className="flex-1 overflow-y-auto p-2.5 space-y-2 text-xs select-text scroll-smooth bg-ink-900/40 rounded-b-xl border border-foreground/5"
          >
            {!conversation || conversation.isEmpty ? (
              <div data-testid="swarm-comms-empty-state" className="h-full flex flex-col items-center justify-center p-4 text-center text-ink-500 space-y-2">
                <Moon className="w-8 h-8 text-ink-500" />
                <p className="text-xs font-sans leading-relaxed">{conversation ? t('mc.noActivity') : t('mc.noConversations')}</p>
              </div>
            ) : (
              <>
                {conversation.dialogues.length > displayedDialogues.length && (
                  <div className="flex justify-center pb-1">
                    <Button type="button" variant="transparent" color="success" size="tiny" className="font-mono text-meta" onClick={() => setSwarmLimit((v) => v + PAGE_SIZE)}>
                      <span>↑</span>
                      <span>{t('ui.inspector.loadOlder', { n: PAGE_SIZE })}</span>
                    </Button>
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
