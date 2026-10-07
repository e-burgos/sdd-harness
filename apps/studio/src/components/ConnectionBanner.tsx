'use client';

import type { ConnectionState } from '@/lib/bridge/client';
import { useT } from '@/lib/i18n/i18n';

export function ConnectionBanner({
  connection,
  syncError,
  onRetry,
}: {
  connection: ConnectionState;
  syncError?: string | null;
  onRetry?: () => void;
}) {
  const { t } = useT();
  if (syncError) {
    return (
      <div role="alert" className="flex items-center justify-center gap-3 border-b border-roseish/30 bg-roseish/10 px-4 py-1.5 text-xs text-roseish">
        <span>{t('conn.syncError', { message: syncError })}</span>
        {onRetry && (
          <button className="rounded border border-roseish/40 px-2 py-0.5 hover:bg-roseish/20" onClick={onRetry}>
            {t('conn.retry')}
          </button>
        )}
      </div>
    );
  }
  if (connection.status === 'open' || connection.status === 'idle' || connection.status === 'failed') return null;
  const text =
    connection.status === 'reconnecting'
      ? t('conn.reconnecting', { seconds: Math.ceil(connection.delayMs / 1000) })
      : t('conn.connecting');
  return (
    <div role="status" className="border-b border-amberish/30 bg-amberish/10 px-4 py-1.5 text-center text-xs text-amberish">
      {text}
    </div>
  );
}
