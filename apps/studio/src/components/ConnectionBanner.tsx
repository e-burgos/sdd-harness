'use client';

import type { ConnectionState } from '@/lib/bridge/client';
import { useT } from '@/lib/i18n/i18n';

export function ConnectionBanner({ connection }: { connection: ConnectionState }) {
  const { t } = useT();
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
