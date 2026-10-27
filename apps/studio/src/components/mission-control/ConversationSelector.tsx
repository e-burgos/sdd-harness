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
        <span data-testid="conversation-selector-empty" className="font-mono text-meta text-ink-300">
          {t('mc.noConversations')}
        </span>
      ) : (
        <HelpSelect
          label={t('mc.conversations')}
          help={t('help.conversation.select')}
          value={selectedThreadId ?? ''}
          options={conversations.map((conversation) => ({ value: conversation.id, label: labelOf(conversation) }))}
          onChange={onPick}
          className="max-w-[220px] font-mono"
        />
      )}
      <NewConversationButton onNewConversation={onNewConversation} className="shrink-0" />
    </div>
  );
}
