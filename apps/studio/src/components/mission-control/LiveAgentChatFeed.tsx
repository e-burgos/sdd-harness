'use client';

import { Button, Input, Tooltip } from '@e-burgos/tucu-ui';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, Moon } from 'lucide-react';
import { ThreadInfo, channelForDm, defaultThreadOptions } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import type { ConversationView } from '@/lib/conversation';
import { useT } from '@/lib/i18n/i18n';
import { useBridge } from '../BridgeProvider';
import { ChatDialogueCard } from './ChatDialogueCard';

interface LiveAgentChatFeedProps {
  agentId: string;
  conversation: ConversationView | null;
  onPickConversation?: (threadId: string) => void;
}

const PAGE_SIZE = 50;

export function LiveAgentChatFeed({ agentId, conversation, onPickConversation }: LiveAgentChatFeedProps) {
  const { client } = useBridge();
  const { t } = useT();
  const displayName = (id: string): string => (id === 'user' ? t('ui.you') : agentMeta(id).name);
  const [quickInput, setQuickInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);

  const meta = agentMeta(agentId);

  const agentDialogues = useMemo(
    () => (conversation?.dialogues ?? []).filter((d) => d.from === agentId || d.to === agentId),
    [conversation, agentId],
  );
  const visibleDialogues = useMemo(() => agentDialogues.slice(-visibleLimit), [agentDialogues, visibleLimit]);
  const hiddenCount = agentDialogues.length - visibleDialogues.length;
  const hasLive = agentDialogues.some((d) => d.isLive);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visibleDialogues.length]);

  const sendQuickMessage = async (text: string) => {
    const body = { text, attachments: [], refs: { agents: [agentId], skills: [] } };
    if (conversation?.threadId) {
      await client.request({ cmd: 'thread.send', threadId: conversation.threadId, ...body });
      return;
    }
    const created = ThreadInfo.parse(
      await client.request({ cmd: 'thread.create', channelId: channelForDm(agentId), options: defaultThreadOptions(agentId), ...body }),
    );
    onPickConversation?.(created.id);
  };

  const handleSendQuick = async (e: FormEvent) => {
    e.preventDefault();
    const text = quickInput.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setSendError(null);
    try {
      await sendQuickMessage(text);
      setQuickInput('');
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : t('ui.feed.sendError'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      data-testid="live-agent-chat-feed"
      className="flex-1 flex flex-col min-h-0 bg-ink-900/60 rounded-xl border border-foreground/10 overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-foreground/10 bg-foreground/5">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${hasLive ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'}`} />
          <span className="text-micro font-mono font-bold text-ink-100 uppercase tracking-wider">
            {hasLive ? t('map.chat.live') : t('mc.conversations')} ({agentDialogues.length})
          </span>
        </div>
        <span className="text-micro font-mono px-1.5 py-0.5 rounded bg-foreground/10 text-ink-300" style={{ color: meta.color }}>
          @{meta.name}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2.5 space-y-2.5 text-xs select-text scroll-smooth">
        {agentDialogues.length === 0 ? (
          <div data-testid="live-agent-chat-feed-empty" className="h-full flex flex-col items-center justify-center p-4 text-center text-ink-500 space-y-2">
            <Moon className="w-8 h-8 text-ink-500" />
            <p className="text-xs font-sans leading-relaxed">{t('mc.noActivity')}</p>
          </div>
        ) : (
          <>
            {hiddenCount > 0 && (
              <div className="flex justify-center pb-1">
                <Button type="button" variant="transparent" color="success" size="tiny" className="font-mono text-meta" onClick={() => setVisibleLimit((v) => v + PAGE_SIZE)}>
                  <ArrowUp className="w-3 h-3" />
                  <span>{t('ui.feed.loadMore', { n: PAGE_SIZE })}</span>
                  <span className="text-ink-500">{t('ui.feed.remaining', { n: hiddenCount })}</span>
                </Button>
              </div>
            )}
            {visibleDialogues.map((dialogue) => {
              const sender = agentMeta(dialogue.from);
              const receiver = dialogue.to ? agentMeta(dialogue.to) : null;
              return (
                <ChatDialogueCard
                  key={dialogue.id}
                  id={dialogue.id}
                  senderId={dialogue.from}
                  senderName={displayName(dialogue.from)}
                  senderColor={sender.color}
                  receiverId={dialogue.to ?? undefined}
                  receiverName={dialogue.to ? displayName(dialogue.to) : undefined}
                  receiverColor={receiver?.color}
                  text={dialogue.text}
                  badge={dialogue.isLive ? 'LIVE' : dialogue.tool?.toUpperCase()}
                  gateId={dialogue.gateId}
                  isLive={dialogue.isLive}
                  seqNumber={dialogue.seq}
                  provider={conversation?.provider}
                />
              );
            })}
          </>
        )}
      </div>

      <form onSubmit={handleSendQuick} className="p-2 border-t border-foreground/10 bg-ink-950/90 flex flex-col gap-1.5">
        {sendError && <span className="text-micro text-rose-400 font-mono px-1">{sendError}</span>}
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder={t('map.chat.placeholder', { name: meta.name })}
            disabled={isSending}
            className="flex-1"
            inputClassName="h-auto sm:h-auto rounded-lg px-2.5 py-1.5 text-ui"
          />
          <Tooltip lazy size="xs" arrow={false} content={t('ui.feed.sendTo', { name: meta.name })}>
            <Button type="submit" size="tiny" disabled={isSending || !quickInput.trim()}>
              {isSending ? (
                <>
                  <span className="h-2.5 w-2.5 rounded-full border border-foreground border-t-transparent animate-spin" />
                  <span>{t('ui.feed.sending')}</span>
                </>
              ) : (
                <span>{t('map.chat.send')}</span>
              )}
            </Button>
          </Tooltip>
        </div>
      </form>
    </div>
  );
}
