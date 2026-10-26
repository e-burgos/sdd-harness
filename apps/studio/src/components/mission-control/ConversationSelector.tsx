'use client';

import type { ThreadInfo } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { HelpSelect } from '../HelpSelect';
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
        <HelpSelect
          help={t('help.conversation.select')}
          data-testid="conversation-select"
          aria-label={t('mc.conversations')}
          value={selectedThreadId ?? ''}
          onChange={(event) => onPick(event.target.value)}
          className="max-w-[220px] cursor-pointer truncate rounded-lg border border-white/10 bg-white/5 py-1 pl-2.5 pr-2 font-mono text-[11px] text-white focus:border-emerald-400 focus:outline-none"
        >
          {conversations.map((conversation) => (
            <option key={conversation.id} value={conversation.id} data-testid={`conversation-option-${conversation.id}`} className="bg-ink-950 text-white">
              {labelOf(conversation)}
            </option>
          ))}
        </HelpSelect>
      )}
      <NewConversationButton onNewConversation={onNewConversation} className="shrink-0" />
    </div>
  );
}
