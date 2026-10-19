'use client';

import { ArrowLeft, StopCircle } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { openThread } from '@/lib/bootstrap';
import { useT } from '@/lib/i18n/i18n';
import { useBridge, useStudio } from '../BridgeProvider';
import { StatusBadge } from './StatusBadge';
import { Timeline } from './Timeline';

const BUSY = new Set(['running', 'waiting-approval', 'queued']);
const NEAR_BOTTOM_PX = 120;
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';

export function ThreadView({ threadId, onBack, composer }: { threadId: string; onBack(): void; composer: ReactNode }) {
  const { t } = useT();
  const { client, store, connection } = useBridge();
  const thread = useStudio((s) => s.threads[threadId]);
  const synced = thread?.synced ?? false;
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [interruptError, setInterruptError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    openThread(client, store, threadId).catch((e: unknown) => setLoadError(msg(e)));
  }, [client, store, threadId]);

  // Si el hilo ya está sincronizado, el bootstrap se ocupa de re-sincronizar al reconectar.
  useEffect(() => {
    if (connection.status === 'open' && !synced) load();
  }, [connection.status, synced, load]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
  };
  const count = thread?.items.length;
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [count]);

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
      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
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
          onRespond={(approvalId, decision, scope, reason) =>
            client.request({ cmd: 'approval.respond', approvalId, decision, scope, ...(reason ? { reason } : {}) })
          }
        />
      </div>
      {composer}
    </section>
  );
}
