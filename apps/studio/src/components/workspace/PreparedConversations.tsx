'use client';

import { Button } from '@e-burgos/tucu-ui';
import { MessageSquarePlus, X } from 'lucide-react';
import { briefingFor, preparedLabelOf, type PreparedConversation } from '@/lib/auto-conversation';
import { useT } from '@/lib/i18n/i18n';
import { useBridge, useStudio } from '../BridgeProvider';


export function PreparedConversations({ onOpen }: { onOpen(prepared: PreparedConversation, briefing: string): void }) {
  const { t } = useT();
  const { store } = useBridge();
  const prepared = useStudio((s) => s.prepared);
  const snapshot = useStudio((s) => s.snapshot);
  if (prepared.length === 0) return null;
  return (
    <ul data-testid="prepared-conversations" className="absolute left-1/2 top-2 z-20 flex w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2">
      {prepared.map((item) => (
        <li key={item.id} className="flex items-center gap-2 rounded-lg border border-accent-400/40 bg-ink-900 px-3 py-2 text-xs shadow-lg">
          <MessageSquarePlus size={16} className="shrink-0 text-accent-300" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-ink-100">{t('prepared.title', { label: preparedLabelOf(item.target) })}</span>
            <span className="block truncate text-ink-400">{t('prepared.hint')}</span>
          </span>
          <Button type="button" size="tiny" onClick={() => onOpen(item, briefingFor(item, snapshot))}>
            {t('prepared.open')}
          </Button>
          <Button type="button" variant="transparent" color="gray" shape="circle" size="tiny" aria-label={t('prepared.dismiss')} onClick={() => store.getState().dismissPrepared(item.id)}>
            <X size={14} aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
}
