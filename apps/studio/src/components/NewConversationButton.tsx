'use client';

import { Button } from '@e-burgos/tucu-ui';
import { MessageSquarePlus } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';

export interface NewConversationButtonProps {
  onNewConversation: () => void;
  className?: string;
  fullWidth?: boolean;
}

export function NewConversationButton({ onNewConversation, className, fullWidth }: NewConversationButtonProps) {
  const { t } = useT();
  return (
    <div className={className}>
      <Button
        type="button"
        data-testid="new-conversation-button"
        onClick={onNewConversation}
        size="tiny"
        fullWidth={fullWidth}
      >
        <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
        <span>{t('mc.newConversation')}</span>
      </Button>
    </div>
  );
}
