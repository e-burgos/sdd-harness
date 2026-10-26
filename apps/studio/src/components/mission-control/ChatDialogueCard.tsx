'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { GateId } from '@/lib/gates';
import { AgentFace } from '../workspace/AgentFace';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ChatDialogueCardProps {
  id: string;
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
  isCurrent?: boolean;
  seqNumber?: number;
  provider?: string;
  onClick?: () => void;
}

export function ChatDialogueCard({
  id: _id,
  senderId,
  senderName,
  senderColor = '#38bdf8',
  receiverId,
  receiverName,
  receiverColor = '#e2e8f0',
  text,
  badge,
  gateId,
  isLive,
  isCurrent,
  seqNumber,
  provider,
  onClick,
}: ChatDialogueCardProps) {
  const isLong = text.length > 150 || (text.match(/\n/g) || []).length >= 2;
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      onClick={onClick}
      className={`group rounded-xl border p-2.5 transition-all select-text ${
        onClick ? 'cursor-pointer' : ''
      } ${
        isCurrent
          ? 'border-emerald-500/70 bg-emerald-950/30 shadow-[0_0_16px_rgba(16,185,129,0.22)]'
          : 'border-white/10 bg-ink-950/80 hover:border-white/20 hover:bg-ink-900/90'
      }`}
    >
      <div className="flex items-center justify-between mb-2 text-[10px] font-mono select-none">
        <div className="flex items-center gap-1.5 truncate">
          {senderId && (
            <div
              className="h-4 w-4 rounded-full flex items-center justify-center shrink-0 border border-white/10"
              style={{ backgroundColor: `${senderColor}25` }}
            >
              <AgentFace agent={senderId} size={14} />
            </div>
          )}
          <span className="font-bold truncate" style={{ color: senderColor }}>
            {senderName}
          </span>

          {receiverName && (
            <>
              <ArrowRight className="w-2.5 h-2.5 text-white/30 shrink-0" />
              {receiverId && (
                <div
                  className="h-4 w-4 rounded-full flex items-center justify-center shrink-0 border border-white/10"
                  style={{ backgroundColor: `${receiverColor}25` }}
                >
                  <AgentFace agent={receiverId} size={14} />
                </div>
              )}
              <span className="truncate" style={{ color: receiverColor }}>
                {receiverName}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {provider && (
            <span
              data-testid="dialogue-provider"
              className="text-[8px] font-bold px-1.5 py-0.2 rounded border font-mono text-purple-300 bg-purple-500/10 border-purple-500/30"
            >
              {provider.toUpperCase()}
            </span>
          )}
          {gateId && (
            <span className="bg-yellow-500/15 text-yellow-300 border border-yellow-500/40 text-[8px] font-mono px-1.5 py-0.2 rounded uppercase font-bold tracking-wider">
              {gateId.toUpperCase()}
            </span>
          )}
          {badge && (
            <span
              className={`text-[8px] font-bold px-1.5 py-0.2 rounded border font-mono ${
                isLive
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                  : 'text-white/70 bg-white/5 border-white/10'
              }`}
            >
              {badge}
            </span>
          )}
          {seqNumber !== undefined && (
            <span className="text-white/30 text-[9px] font-mono">#{seqNumber}</span>
          )}
        </div>
      </div>

      <div className="relative text-xs leading-relaxed text-white/90 font-sans">
        <div
          className={`transition-all duration-200 ${
            isLong && !isExpanded ? 'max-h-[72px] overflow-hidden' : 'max-h-none'
          }`}
        >
          <div className="prose-studio min-w-0 break-words text-[11px] leading-relaxed [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[10px] [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-ink-950 [&_pre]:p-2.5 [&_a]:text-sky-300 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1 [&_h1]:text-xs [&_h1]:font-bold [&_h2]:text-xs [&_h2]:font-bold [&_h3]:text-xs [&_h3]:font-bold [&_h4]:text-xs [&_h4]:font-bold [&_strong]:text-white">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        </div>

        {isLong && !isExpanded && (
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent pointer-events-none" />
        )}
      </div>

      {isLong && (
        <div className="mt-1.5 pt-1 border-t border-white/5 flex items-center justify-between select-none">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span>{isExpanded ? '⌃' : '⌄'}</span>
            <span>{isExpanded ? 'Mostrar menos' : 'Mostrar más'}</span>
          </button>
          <span className="text-[9px] font-mono text-white/30">
            {text.length} caracteres
          </span>
        </div>
      )}
    </div>
  );
}
