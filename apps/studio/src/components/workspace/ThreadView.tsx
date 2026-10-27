'use client';

import { Button } from '@e-burgos/tucu-ui';
import { ArrowDown, ArrowLeft, StopCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { openThread } from '@/lib/bootstrap';
import { useT } from '@/lib/i18n/i18n';
import { useStickToBottom } from '@/lib/use-stick-to-bottom';
import { useBridge, useStudio } from '../BridgeProvider';
import { ActivityIndicator, INDICATED_STATUSES } from './ActivityIndicator';
import { ContextMeter } from './ContextMeter';
import { StatusBadge } from './StatusBadge';
import { ThreadLinkPicker } from './ThreadLinkPicker';
import { Timeline } from './Timeline';

const BUSY = new Set(['running', 'waiting-approval', 'queued']);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function ThreadView({ threadId, onBack, composer, onNewConversation }: { threadId: string; onBack(): void; composer: ReactNode; onNewConversation?(): void }) {
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
        <Button type="button" variant="transparent" color="gray" shape="circle" size="mini" aria-label={t('thread.back')} onClick={onBack}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{info?.title ?? '…'}</h1>
        <ThreadLinkPicker threadId={threadId} />
        {info && <ContextMeter usage={info.contextUsage} onNewConversation={onNewConversation} />}
        {info && <StatusBadge status={info.status} />}
        {info && BUSY.has(info.status) && (
          <Button type="button" variant="ghost" color="danger" size="tiny" onClick={interrupt}>
            <StopCircle size={14} /> {t('thread.interrupt')}
          </Button>
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
                <Button type="button" variant="ghost" color="danger" size="tiny" onClick={load}>
                  {t('conn.retry')}
                </Button>
              </div>
            )}
            <Timeline
              items={thread?.items ?? []}
              status={info?.status}
              onRespond={(approvalId, decision, scope, reason) =>
                client.request({ cmd: 'approval.respond', approvalId, decision, scope, ...(reason ? { reason } : {}) })
              }
              onAnswerQuestion={(questionId, answers, decline) => client.request({ cmd: 'question.answer', questionId, answers, decline })}
            />
            <div className="mt-2 flex h-6 items-center gap-2 pl-11 text-xs text-ink-300" data-testid="thread-activity">
              <ActivityIndicator status={info?.status ?? null} placement="thread" />
              {info && INDICATED_STATUSES.has(info.status) && <span>{t(`status.${info.status}`)}</span>}
            </div>
          </div>
        </div>
        {!atBottom && (
          <div className="absolute bottom-3 right-5">
            <Button type="button" variant="solid" color="gray" shape="pill" size="tiny" onClick={scrollToBottom}>
              <ArrowDown size={12} /> {t('thread.jumpToLatest')}
            </Button>
          </div>
        )}
      </div>
      {composer}
    </section>
  );
}
