'use client';

import { Button, EmptyState } from '@e-burgos/tucu-ui';
import { channelForSpec, type SpecSummary } from '@sdd-studio/protocol';
import { MessageSquare } from 'lucide-react';
import { useMemo } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { useBridge } from '../../BridgeProvider';
import { Chip } from '../../workspace/NavParts';
import { Item } from './SpecParts';
import { useSpecThreads } from './use-spec-threads';

export function SpecConversationsTab({ spec }: { spec: SpecSummary }) {
  const { t, lang } = useT();
  const { store } = useBridge();
  const openHome = useNav((s) => s.openHome);
  const startNewConversation = useNav((s) => s.startNewConversation);
  const threads = useSpecThreads(spec.id);

  const startOne = () => {
    openHome({ kind: 'channel', channelId: channelForSpec(spec.id) });
    startNewConversation();
  };
  const openThread = (threadId: string) => {
    store.getState().selectThread(threadId);
    openHome({ kind: 'thread', threadId });
  };
  const dateOf = useMemo(() => (iso: string) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' });
  }, [lang]);

  if (threads.length === 0) {
    return (
      <EmptyState
        size="sm"
        title={t('specs.conv.empty')}
        action={
          <Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" onClick={startOne}>
            {t('specs.conv.start')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {threads.map((info) => {
        const title = info.title.trim() === '' ? t('specs.conv.untitled') : info.title;
        return (
          <Item
            key={info.id}
            icon={MessageSquare}
            label={title}
            ariaLabel={t('specs.conv.open', { title })}
            meta={dateOf(info.lastActivity)}
            trailing={
              <>
                {info.pendingCount > 0 && <Chip tone="warning">{t('specs.conv.pending', { count: info.pendingCount })}</Chip>}
                <Chip tone={info.status === 'error' ? 'danger' : info.status === 'running' ? 'success' : 'neutral'}>{t(`status.${info.status}`)}</Chip>
              </>
            }
            onClick={() => openThread(info.id)}
          />
        );
      })}
    </div>
  );
}
