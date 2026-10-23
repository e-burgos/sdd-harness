'use client';

import { ArrowDown, ArrowLeft, StopCircle } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { openThread } from '@/lib/bootstrap';
import { useT } from '@/lib/i18n/i18n';
import { useStickToBottom } from '@/lib/use-stick-to-bottom';
import { useBridge, useStudio } from '../BridgeProvider';
import { ActivityIndicator, INDICATED_STATUSES } from './ActivityIndicator';
import { StatusBadge } from './StatusBadge';
import { ThreadLinkPicker } from './ThreadLinkPicker';
import { Timeline } from './Timeline';

const BUSY = new Set(['running', 'waiting-approval', 'queued']);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';

export function ThreadView({ threadId, onBack, composer }: { threadId: string; onBack(): void; composer: ReactNode }) {
  const { t } = useT();
  const { client, store, connection } = useBridge();
  const thread = useStudio((s) => s.threads[threadId]);
  const synced = thread?.synced ?? false;
  const { scrollerRef, contentRef, atBottom, onScroll, scrollToBottom } = useStickToBottom();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [interruptError, setInterruptError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    openThread(client, store, threadId).catch((e: unknown) => setLoadError(msg(e)));
  }, [client, store, threadId]);

  // If the thread is already synced, the bootstrap re-syncs it on reconnect.
  useEffect(() => {
    if (connection.status === 'open' && !synced) load();
  }, [connection.status, synced, load]);

  useEffect(() => {
    if (synced) scrollToBottom();
  }, [synced, scrollToBottom]);

  const lastUserItemId = useMemo(() => thread?.items.filter((i) => i.kind === 'user').at(-1)?.id, [thread?.items]);
  useEffect(() => {
    if (lastUserItemId) scrollToBottom();
  }, [lastUserItemId, scrollToBottom]);

  const interrupt = () => {
    setInterruptError(null);
    client.request({ cmd: 'thread.interrupt', threadId }).catch((e: unknown) => setInterruptError(msg(e)));
  };

  const info = thread?.info;
  return (
    <section className="flex h-full min-w-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-ink-800 px-5 py-3">
        <button aria-label={t('thread.back')} className={`rounded-md p-1 text-ink-300 hover:bg-ink-800 ${ring}`} onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{info?.title ?? '…'}</h1>
        <ThreadLinkPicker threadId={threadId} />
        {info && <StatusBadge status={info.status} />}
        {info && BUSY.has(info.status) && (
          <button
            className={`inline-flex items-center gap-1 rounded-md border border-roseish/50 px-2 py-1 text-xs text-roseish hover:bg-roseish/10 ${ring}`}
            onClick={interrupt}
          >
            <StopCircle size={14} /> {t('thread.interrupt')}
          </button>
        )}
        {interruptError && (
          <p role="alert" className="basis-full text-xs text-roseish">
            {interruptError}
          </p>
        )}
      </header>
      <div className="relative min-h-0 flex-1">
        <div data-testid="thread-scroller" ref={scrollerRef} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain px-5 py-4">
          <div ref={contentRef}>
            {loadError && (
              <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-roseish/40 bg-roseish/10 p-3 text-xs text-roseish">
                <span className="min-w-0 break-words">{t('conn.syncError', { message: loadError })}</span>
                <button className={`rounded-md border border-roseish/50 px-2 py-1 hover:bg-roseish/10 ${ring}`} onClick={load}>
                  {t('conn.retry')}
                </button>
              </div>
            )}
            <Timeline
              items={thread?.items ?? []}
              status={info?.status}
              onRespond={(approvalId, decision, scope, reason) =>
                client.request({ cmd: 'approval.respond', approvalId, decision, scope, ...(reason ? { reason } : {}) })
              }
            />
            <div className="mt-2 flex h-6 items-center gap-2 pl-11 text-xs text-ink-300" data-testid="thread-activity">
              <ActivityIndicator status={info?.status ?? null} placement="thread" />
              {info && INDICATED_STATUSES.has(info.status) && <span>{t(`status.${info.status}`)}</span>}
            </div>
          </div>
        </div>
        {!atBottom && (
          <button
            className={`absolute bottom-3 right-5 inline-flex items-center gap-1 rounded-full border border-ink-700 bg-ink-800 px-3 py-1 text-xs text-ink-100 shadow hover:bg-ink-700 ${ring}`}
            onClick={scrollToBottom}
          >
            <ArrowDown size={12} /> {t('thread.jumpToLatest')}
          </button>
        )}
      </div>
      {composer}
    </section>
  );
}
