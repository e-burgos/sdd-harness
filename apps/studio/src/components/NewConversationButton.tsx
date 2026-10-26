'use client';

import { MessageSquarePlus } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';

export interface NewConversationButtonProps {
  onNewConversation: () => void;
  className?: string;
}

export function NewConversationButton({ onNewConversation, className = '' }: NewConversationButtonProps) {
  const { t } = useT();
  return (
    <button
      type="button"
      data-testid="new-conversation-button"
      onClick={onNewConversation}
      className={`inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-ink-950 transition-colors hover:bg-emerald-400 ${className}`}
    >
      <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
      <span>{t('mc.newConversation')}</span>
    </button>
  );
}
