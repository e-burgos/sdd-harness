'use client';

import type { ThreadInfo } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { NewConversationButton } from '../NewConversationButton';

export interface ConversationSelectorProps {
  conversations: ThreadInfo[];
  selectedThreadId: string | null;
  onPick: (threadId: string) => void;
  onNewConversation: () => void;
}

export function ConversationSelector({ conversations, selectedThreadId, onPick, onNewConversation }: ConversationSelectorProps) {
  const { t } = useT();
  return (
    <nav
      data-testid="conversation-selector"
      aria-label={t('mc.conversations')}
      className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-950/80 px-2 py-1.5 backdrop-blur"
    >
      {conversations.length === 0 ? (
        <span data-testid="conversation-selector-empty" className="flex-1 font-mono text-[11px] text-white/60">
          {t('mc.noConversations')}
        </span>
      ) : (
        <ul className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {conversations.map((conversation) => {
            const selected = conversation.id === selectedThreadId;
            return (
              <li key={conversation.id} className="shrink-0">
                <button
                  type="button"
                  data-testid={`conversation-option-${conversation.id}`}
                  aria-pressed={selected}
                  title={conversation.title || conversation.id}
                  onClick={() => onPick(conversation.id)}
                  className={`max-w-[200px] truncate rounded-lg px-2.5 py-1 font-mono text-[11px] transition-colors ${
                    selected ? 'bg-emerald-500 font-bold text-ink-950' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {conversation.title || conversation.id}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <NewConversationButton onNewConversation={onNewConversation} className="shrink-0" />
    </nav>
  );
}
