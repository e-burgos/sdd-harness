'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { bridgeErrorText } from '@/lib/bridge/error-text';
import { useT } from '@/lib/i18n/i18n';
import { useBridge, useStudio } from '../BridgeProvider';

const BUSY = new Set(['running', 'waiting-approval', 'queued']);
const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-50';
const ghost = `rounded-md border border-ink-700 px-2 py-0.5 text-xs hover:bg-ink-800 ${ring}`;

export function PendingMessages({ threadId }: { threadId: string }) {
  const { t } = useT();
  const { client } = useBridge();
  const pending = useStudio((s) => s.threads[threadId]?.pending);
  const status = useStudio((s) => s.threads[threadId]?.info?.status);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inFlight = useRef(false);

  const run = async (id: string, action: () => Promise<unknown>): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusyId(id);
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError(bridgeErrorText(e, t));
      return false;
    } finally {
      inFlight.current = false;
      setBusyId(null);
    }
  };

  const editingItem = pending?.find((i) => i.id === editing?.id);
  const emptyBlocked = editing !== null && editing.text.trim() === '' && !(editingItem?.attachments?.length);

  const save = async () => {
    if (!editing || emptyBlocked) return;
    const { id, text } = editing;
    if (await run(id, () => client.request({ cmd: 'thread.pending.edit', threadId, pendingId: id, text }))) setEditing(null);
  };
  const remove = (id: string) => run(id, () => client.request({ cmd: 'thread.pending.remove', threadId, pendingId: id }));
  const flush = () => run('flush', () => client.request({ cmd: 'thread.pending.flush', threadId }));

  const items = pending ?? [];
  if (items.length === 0 && !error) return null;
  const busy = status ? BUSY.has(status) : false;
  return (
    <section aria-label={t('pending.title')} data-testid="pending-messages" className="border-t border-ink-800 bg-ink-900/60 px-3 pb-1 pt-2">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-ink-300">
        <span className="font-medium">{t('pending.title')} ({items.length})</span>
        <span className="min-w-0 flex-1">{busy ? t('pending.hintBusy') : t('pending.hintIdle')}</span>
        {!busy && items.length > 0 && (
          <button className={ghost} disabled={busyId !== null} onClick={() => void flush()}>
            {t('pending.flush')}
          </button>
        )}
      </div>
      {error && <p role="alert" className="mb-1 text-xs text-roseish">{error}</p>}
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const isEditing = editing?.id === item.id;
          return (
            <li key={item.id} className="flex items-start gap-2 rounded-md border border-ink-800 bg-ink-950 px-2 py-1.5 text-sm">
              <span className="mt-0.5 shrink-0 rounded bg-amberish/15 px-1.5 text-[11px] text-amberish">{t('pending.badge')}</span>
              {isEditing ? (
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <textarea
                    aria-label={t('pending.editLabel')}
                    className={`min-h-[44px] w-full resize-y rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-sm ${ring}`}
                    value={editing.text}
                    autoFocus
                    onChange={(e) => setEditing({ id: item.id, text: e.target.value })}
                  />
                  {emptyBlocked && <p className="text-xs text-amberish">{t('pending.emptyHint')}</p>}
                  <div className="flex gap-2">
                    <button className={ghost} disabled={emptyBlocked || busyId !== null} onClick={() => void save()}>
                      {t('pending.save')}
                    </button>
                    <button className={ghost} disabled={busyId !== null} onClick={() => setEditing(null)}>
                      {t('pending.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    {item.text !== '' && <p className="whitespace-pre-wrap break-words">{item.text}</p>}
                    {item.attachments && item.attachments.length > 0 && (
                      <ul aria-label={t('attach.tray')} className="mt-0.5 flex flex-wrap gap-1">
                        {item.attachments.map((a) => (
                          <li key={a.sha256} className="max-w-[10rem] truncate rounded bg-ink-800 px-1.5 text-[11px] text-ink-300">{a.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button aria-label={t('pending.edit')} className={`rounded-md p-1 text-ink-300 hover:bg-ink-800 ${ring}`} disabled={busyId !== null} onClick={() => setEditing({ id: item.id, text: item.text })}>
                    <Pencil size={14} />
                  </button>
                  <button aria-label={t('pending.remove')} className={`rounded-md p-1 text-roseish hover:bg-roseish/10 ${ring}`} disabled={busyId !== null} onClick={() => void remove(item.id)}>
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
