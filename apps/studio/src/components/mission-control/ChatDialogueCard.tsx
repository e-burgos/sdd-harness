'use client';

import { Button } from '@e-burgos/tucu-ui';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { GateId } from '@/lib/gates';
import { useT } from '@/lib/i18n/i18n';
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
  const { t } = useT();
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
          : 'border-foreground/10 bg-ink-950/80 hover:border-foreground/20 hover:bg-ink-900/90'
      }`}
    >
      <div className="flex items-center justify-between mb-2 text-micro font-mono select-none">
        <div className="flex items-center gap-1.5 truncate">
          {senderId && (
            <div
              className="h-4 w-4 rounded-full flex items-center justify-center shrink-0 border border-foreground/10"
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
              <ArrowRight className="w-2.5 h-2.5 text-ink-500 shrink-0" />
              {receiverId && (
                <div
                  className="h-4 w-4 rounded-full flex items-center justify-center shrink-0 border border-foreground/10"
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
              className="text-micro font-bold px-1.5 py-0.2 rounded border font-mono text-purple-300 bg-purple-500/10 border-purple-500/30"
            >
              {provider.toUpperCase()}
            </span>
          )}
          {gateId && (
            <span className="bg-yellow-500/15 text-yellow-300 border border-yellow-500/40 text-micro font-mono px-1.5 py-0.2 rounded uppercase font-bold tracking-wider">
              {gateId.toUpperCase()}
            </span>
          )}
          {badge && (
            <span
              className={`text-micro font-bold px-1.5 py-0.2 rounded border font-mono ${
                isLive
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                  : 'text-ink-300 bg-foreground/5 border-foreground/10'
              }`}
            >
              {badge}
            </span>
          )}
          {seqNumber !== undefined && (
            <span className="text-ink-500 text-micro font-mono">#{seqNumber}</span>
          )}
        </div>
      </div>

      <div className="relative text-xs leading-relaxed text-ink-100 font-sans">
        <div
          className={`transition-all duration-200 ${
            isLong && !isExpanded ? 'max-h-[72px] overflow-hidden' : 'max-h-none'
          }`}
        >
          <div className="prose-studio min-w-0 break-words text-meta leading-relaxed [&_code]:rounded [&_code]:bg-foreground/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-micro [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-ink-950 [&_pre]:p-2.5 [&_a]:text-sky-300 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1 [&_h1]:text-xs [&_h1]:font-bold [&_h2]:text-xs [&_h2]:font-bold [&_h3]:text-xs [&_h3]:font-bold [&_h4]:text-xs [&_h4]:font-bold [&_strong]:text-ink-100">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        </div>

        {isLong && !isExpanded && (
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent pointer-events-none" />
        )}
      </div>

      {isLong && (
        <div className="mt-1.5 pt-1 border-t border-foreground/5 flex items-center justify-between select-none">
          <Button
            type="button"
            variant="transparent"
            color="success"
            size="tiny"
            className="font-mono text-meta!"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <span>{isExpanded ? '⌃' : '⌄'}</span>
            <span>{isExpanded ? t('ui.card.less') : t('ui.card.more')}</span>
          </Button>
          <span className="text-micro font-mono text-ink-500">
            {t('ui.card.chars', { n: text.length })}
          </span>
        </div>
      )}
    </div>
  );
}
