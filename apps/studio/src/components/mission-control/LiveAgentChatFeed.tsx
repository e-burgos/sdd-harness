'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { defaultThreadOptions, channelForDm } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import type { GateId } from '@/lib/gates';
import { extractRuntimeDialogues, SDD_SWARM_SCRIPT, type SwarmDialogue } from './swarm-dialogue';
import { useBridge, useStudio } from '../BridgeProvider';
import { ChatDialogueCard } from './ChatDialogueCard';

interface LiveAgentChatFeedProps {
  agentId: string;
  mode?: 'live' | 'demo';
  onOpenDm?: (agentId: string) => void;
}

interface ActivityItem {
  id: string;
  kind: 'user' | 'agent' | 'tool' | 'dialogue';
  senderId?: string;
  senderName: string;
  senderColor?: string;
  receiverId?: string;
  receiverName?: string;
  receiverColor?: string;
  text: string;
  badge?: string;
  gateId?: GateId;
  isLive?: boolean;
}

export function LiveAgentChatFeed({ agentId, mode = 'live', onOpenDm }: LiveAgentChatFeedProps) {
  const { client } = useBridge();
  const presence = useStudio((s) => s.presence ?? []);
  const threads = useStudio((s) => s.threads ?? {});
  const [quickInput, setQuickInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const meta = agentMeta(agentId);

  const liveDialogues = useMemo(
    () => extractRuntimeDialogues(presence, threads),
    [presence, threads],
  );

  const agentLiveDialogues = useMemo(
    () => liveDialogues.filter((d) => d.from === agentId || d.to === agentId),
    [liveDialogues, agentId],
  );

  const demoDialogues = useMemo(() => {
    const filtered = SDD_SWARM_SCRIPT.filter((d) => d.from === agentId || d.to === agentId);
    return filtered.length > 0 ? filtered : SDD_SWARM_SCRIPT.slice(0, 4);
  }, [agentId]);

  const pastActivityItems = useMemo((): ActivityItem[] => {
    const dmChannel = channelForDm(agentId);
    const matchingThreads = Object.values(threads).filter(
      (t) => t.info?.channelId === dmChannel || t.info?.options?.agent === agentId,
    );
    const result: ActivityItem[] = [];

    for (const thread of matchingThreads) {
      for (const item of (thread.items ?? []).slice(-10)) {
        if (item.kind === 'user' && item.text?.trim()) {
          result.push({
            id: item.id,
            kind: 'user',
            senderName: 'Tú',
            text: item.text,
            badge: 'USUARIO',
          });
        } else if (item.kind === 'message' && item.text?.trim()) {
          result.push({
            id: item.id,
            kind: 'agent',
            senderId: agentId,
            senderName: meta.name,
            senderColor: meta.color,
            text: item.text,
            badge: 'RESPUESTA',
          });
        } else if (item.kind === 'tool') {
          result.push({
            id: item.id,
            kind: 'tool',
            senderId: agentId,
            senderName: meta.name,
            senderColor: meta.color,
            text: item.summary || `Ejecutó ${item.tool}`,
            badge: item.tool.toUpperCase(),
          });
        }
      }
    }
    return result;
  }, [threads, agentId, meta.name, meta.color]);

  const displayItems = useMemo((): ActivityItem[] => {
    if (mode === 'demo') {
      return demoDialogues.map((d, idx) => ({
        id: `${d.id}-${idx}`,
        kind: 'dialogue',
        senderId: d.from,
        senderName: agentMeta(d.from).name,
        senderColor: agentMeta(d.from).color,
        receiverId: d.to,
        receiverName: agentMeta(d.to).name,
        receiverColor: agentMeta(d.to).color,
        text: d.text,
        badge: d.gateId ? d.gateId.toUpperCase() : d.phase.toUpperCase(),
        gateId: d.gateId,
      }));
    }

    if (agentLiveDialogues.length > 0) {
      return agentLiveDialogues.map((d, idx) => ({
        id: `${d.id}-${idx}`,
        kind: 'dialogue',
        senderId: d.from,
        senderName: agentMeta(d.from).name,
        senderColor: agentMeta(d.from).color,
        receiverId: d.to,
        receiverName: agentMeta(d.to).name,
        receiverColor: agentMeta(d.to).color,
        text: d.text,
        badge: 'LIVE',
        isLive: true,
        gateId: d.gateId,
      }));
    }

    return pastActivityItems;
  }, [mode, demoDialogues, agentLiveDialogues, pastActivityItems]);

  const [visibleLimit, setVisibleLimit] = useState(50);
  const visibleItems = useMemo(
    () => displayItems.slice(-visibleLimit),
    [displayItems, visibleLimit],
  );
  const hasMore = displayItems.length > visibleLimit;

  const isLiveActive = mode === 'live' && agentLiveDialogues.length > 0;
  const isDemo = mode === 'demo';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleItems.length]);

  const handleSendQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = quickInput.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setSendError(null);
    try {
      const dmChannel = channelForDm(agentId);
      const matchingThreads = Object.values(threads).filter(
        (t) => t.info?.channelId === dmChannel,
      );
      const targetThread = matchingThreads.sort((a, b) => {
        const timeA = a.info?.lastActivity ? new Date(a.info.lastActivity).getTime() : 0;
        const timeB = b.info?.lastActivity ? new Date(b.info.lastActivity).getTime() : 0;
        return timeB - timeA;
      })[0];

      if (client?.request) {
        if (targetThread?.info?.id) {
          await client.request({
            cmd: 'thread.send',
            threadId: targetThread.info.id,
            text,
            attachments: [],
            refs: { agents: [agentId], skills: [] },
          });
        } else {
          await client.request({
            cmd: 'thread.create',
            channelId: dmChannel,
            options: defaultThreadOptions(agentId),
            text,
            attachments: [],
            refs: { agents: [agentId], skills: [] },
          });
        }
      }
      setQuickInput('');
      if (onOpenDm) {
        onOpenDm(agentId);
      }
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
          <span
            className={`h-2 w-2 rounded-full ${
              isLiveActive
                ? 'bg-rose-400 animate-ping'
                : isDemo
                  ? 'bg-sky-400'
                  : 'bg-emerald-400'
            }`}
          />
          <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
            {isLiveActive
              ? `Conversación en Vivo (${agentLiveDialogues.length})`
              : isDemo
                ? `Simulación Enjambre (${displayItems.length})`
                : displayItems.length > 0
                  ? `Última Actividad (${displayItems.length})`
                  : 'Última Actividad'}
          </span>
        </div>
        <span
          className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70"
          style={{ color: meta.color }}
        >
          @{meta.name}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2.5 space-y-2.5 text-xs select-text scroll-smooth"
      >
        {displayItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center text-white/50 space-y-2">
            <span className="text-2xl">💤</span>
            <p className="text-xs font-sans leading-relaxed">
              Sin actividad registrada aún para {meta.name}.
            </p>
            <p className="text-[10px] font-mono text-white/40">
              Escríbele un mensaje abajo para iniciar una conversación en vivo.
            </p>
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center pb-1">
                <button
                  type="button"
                  onClick={() => setVisibleLimit((v) => v + 50)}
                  className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1 font-mono text-[10px] text-emerald-400 hover:text-emerald-300 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <span>↑</span>
                  <span>Cargar más mensajes (+50)</span>
                  <span className="text-white/40">
                    ({displayItems.length - visibleLimit} restantes)
                  </span>
                </button>
              </div>
            )}
            {visibleItems.map((item, idx) => {
              const isUser = item.kind === 'user';
              const seq = displayItems.length - visibleItems.length + idx + 1;

              return (
                <ChatDialogueCard
                  key={`${item.id}-${idx}`}
                  id={item.id}
                  senderId={item.senderId ?? (isUser ? 'user' : agentId)}
                  senderName={item.senderName}
                  senderColor={item.senderColor ?? (isUser ? '#38bdf8' : meta.color)}
                  receiverId={item.receiverId}
                  receiverName={item.receiverName}
                  receiverColor={item.receiverColor}
                  text={item.text}
                  badge={item.badge}
                  gateId={item.gateId}
                  isLive={item.isLive}
                  seqNumber={seq}
                />
              );
            })}
          </>
        )}
      </div>

      <form
        onSubmit={handleSendQuick}
        className="p-2 border-t border-white/10 bg-ink-950/90 flex flex-col gap-1.5"
      >
        {sendError && (
          <span className="text-[10px] text-rose-400 font-mono px-1">{sendError}</span>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder={`Escribir a ${meta.name}...`}
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
              <span>Enviar</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
