'use client';

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

const USER_NAME = 'Tú';
const PAGE_SIZE = 50;

const displayName = (id: string): string => (id === 'user' ? USER_NAME : agentMeta(id).name);

export function LiveAgentChatFeed({ agentId, conversation, onPickConversation }: LiveAgentChatFeedProps) {
  const { client } = useBridge();
  const { t } = useT();
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
      setSendError(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      data-testid="live-agent-chat-feed"
      className="flex-1 flex flex-col min-h-0 bg-ink-900/60 rounded-xl border border-white/10 overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${hasLive ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'}`} />
          <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
            {hasLive ? t('map.chat.live') : t('mc.conversations')} ({agentDialogues.length})
          </span>
        </div>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70" style={{ color: meta.color }}>
          @{meta.name}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2.5 space-y-2.5 text-xs select-text scroll-smooth">
        {agentDialogues.length === 0 ? (
          <div data-testid="live-agent-chat-feed-empty" className="h-full flex flex-col items-center justify-center p-4 text-center text-white/50 space-y-2">
            <Moon className="w-8 h-8 text-white/30" />
            <p className="text-xs font-sans leading-relaxed">{t('mc.noActivity')}</p>
          </div>
        ) : (
          <>
            {hiddenCount > 0 && (
              <div className="flex justify-center pb-1">
                <button
                  type="button"
                  onClick={() => setVisibleLimit((v) => v + PAGE_SIZE)}
                  className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1 font-mono text-[10px] text-emerald-400 hover:text-emerald-300 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <ArrowUp className="w-3 h-3" />
                  <span>Cargar más mensajes (+{PAGE_SIZE})</span>
                  <span className="text-white/40">({hiddenCount} restantes)</span>
                </button>
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

      <form onSubmit={handleSendQuick} className="p-2 border-t border-white/10 bg-ink-950/90 flex flex-col gap-1.5">
        {sendError && <span className="text-[10px] text-rose-400 font-mono px-1">{sendError}</span>}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder={t('map.chat.placeholder', { name: meta.name })}
            disabled={isSending}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-emerald-400 focus:bg-white/10 transition-colors font-sans disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isSending || !quickInput.trim()}
            className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-ink-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-md shadow-emerald-500/20 shrink-0 disabled:opacity-40 disabled:scale-100 flex items-center gap-1.5"
            title={`Enviar mensaje a ${meta.name}`}
          >
            {isSending ? (
              <>
                <span className="h-2.5 w-2.5 rounded-full border border-ink-950 border-t-transparent animate-spin" />
                <span>Enviando</span>
              </>
            ) : (
              <span>{t('map.chat.send')}</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
