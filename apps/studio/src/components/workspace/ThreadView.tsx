'use client';

import { ArrowLeft, StopCircle } from '@phosphor-icons/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { openThread } from '@/lib/bootstrap';
import { useT } from '@/lib/i18n/i18n';
import { useBridge, useStudio } from '../BridgeProvider';
import { StatusBadge } from './StatusBadge';
import { Timeline } from './Timeline';

const BUSY = new Set(['running', 'waiting-approval', 'queued']);

export function ThreadView({ threadId, onBack, composer }: { threadId: string; onBack(): void; composer: ReactNode }) {
  const { t } = useT();
  const { client, store, connection } = useBridge();
  const thread = useStudio((s) => s.threads[threadId]);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (connection.status === 'open') void openThread(client, store, threadId).catch(() => undefined);
  }, [client, store, threadId, connection.status]);
  useEffect(() => bottom.current?.scrollIntoView?.({ block: 'end' }), [thread?.items.length]);

  const info = thread?.info;
  return (
    <section className="flex h-full min-w-0 flex-col">
      <header className="flex items-center gap-3 border-b border-ink-800 px-5 py-3">
        <button aria-label={t('thread.back')} className="rounded-md p-1 text-ink-300 hover:bg-ink-800" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{info?.title ?? '…'}</h1>
        {info && <StatusBadge status={info.status} />}
        {info && BUSY.has(info.status) && (
          <button
            className="inline-flex items-center gap-1 rounded-md border border-roseish/50 px-2 py-1 text-xs text-roseish hover:bg-roseish/10"
            onClick={() => void client.request({ cmd: 'thread.interrupt', threadId }).catch(() => undefined)}
          >
            <StopCircle size={14} /> {t('thread.interrupt')}
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <Timeline
          items={thread?.items ?? []}
          onRespond={(approvalId, decision, scope, reason) =>
            void client.request({ cmd: 'approval.respond', approvalId, decision, scope, ...(reason ? { reason } : {}) }).catch(() => undefined)
          }
        />
        <div ref={bottom} />
      </div>
      {composer}
    </section>
  );
}
