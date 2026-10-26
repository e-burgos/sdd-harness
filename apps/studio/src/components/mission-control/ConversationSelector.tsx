'use client';

import { ChevronDown } from 'lucide-react';
import type { ThreadInfo } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { NewConversationButton } from '../NewConversationButton';

export interface ConversationSelectorProps {
  conversations: ThreadInfo[];
  selectedThreadId: string | null;
  onPick: (threadId: string) => void;
  onNewConversation: () => void;
}

const labelOf = (conversation: ThreadInfo): string => conversation.title || conversation.id;

export function ConversationSelector({ conversations, selectedThreadId, onPick, onNewConversation }: ConversationSelectorProps) {
  const { t } = useT();
  return (
    <div data-testid="conversation-selector" className="flex items-center gap-2">
      {conversations.length === 0 ? (
        <span data-testid="conversation-selector-empty" className="font-mono text-[11px] text-white/60">
          {t('mc.noConversations')}
        </span>
      ) : (
        <div className="relative">
          <select
            data-testid="conversation-select"
            aria-label={t('mc.conversations')}
            value={selectedThreadId ?? ''}
            onChange={(event) => onPick(event.target.value)}
            className="max-w-[220px] cursor-pointer appearance-none truncate rounded-lg border border-white/10 bg-white/5 py-1 pl-2.5 pr-7 font-mono text-[11px] text-white focus:border-emerald-400 focus:outline-none"
          >
            {conversations.map((conversation) => (
              <option key={conversation.id} value={conversation.id} data-testid={`conversation-option-${conversation.id}`} className="bg-ink-950 text-white">
                {labelOf(conversation)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/50" aria-hidden />
        </div>
      )}
      <NewConversationButton onNewConversation={onNewConversation} className="shrink-0" />
    </div>
  );
}
