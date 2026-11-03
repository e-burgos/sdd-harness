'use client';

import { Button, Tooltip } from '@e-burgos/tucu-ui';
import { Plus } from 'lucide-react';
import { useT } from '@/lib/i18n/i18n';

export function NewConversationIconButton({ onClick }: { onClick(): void }) {
  const { t } = useT();
  return (
    <Tooltip size="xs" arrow={false} contentClassName="text-meta" content={t('mc.newConversation')} placement="bottom">
      <Button
        type="button"
        data-testid="new-conversation-button"
        variant="outline"
        color="gray"
        size="mini"
        aria-label={t('mc.newConversation')}
        className="h-7 w-7 shrink-0 p-0 text-ui"
        onClick={onClick}
      >
        <Plus aria-hidden size={14} />
      </Button>
    </Tooltip>
  );
}
