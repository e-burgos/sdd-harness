'use client';

import { Alert, Button } from '@e-burgos/tucu-ui';
import type { ConnectionState } from '@/lib/bridge/client';
import { useT } from '@/lib/i18n/i18n';
import type { SwitchingState } from './BridgeProvider';

export function ConnectionBanner({
  connection,
  syncError,
  onRetry,
  switching,
  onRetrySwitch,
}: {
  connection: ConnectionState;
  syncError?: string | null;
  onRetry?: () => void;
  switching?: SwitchingState | null;
  onRetrySwitch?: () => void;
}) {
  const { t } = useT();
  if (switching?.failed) {
    return (
      <Alert variant="error" density="compact" className="flex items-center justify-center gap-3 rounded-none border-x-0 border-t-0 text-ui shadow-none">
        <span>{t('switch.failed', { project: switching.project, root: switching.root })}</span>
        {onRetrySwitch && (
          <Button type="button" variant="ghost" color="danger" size="tiny" onClick={onRetrySwitch}>
            {t('switch.retry')}
          </Button>
        )}
      </Alert>
    );
  }
  if (switching) {
    return (
      <div role="status" className="border-b border-amberish/30 bg-amberish/10 px-4 py-1.5 text-center text-ui text-amberish">
        {t('switch.opening', { project: switching.project })}
      </div>
    );
  }
  if (syncError) {
    return (
      <Alert variant="error" density="compact" className="flex items-center justify-center gap-3 rounded-none border-x-0 border-t-0 text-xs shadow-none">
        <span>{t('conn.syncError', { message: syncError })}</span>
        {onRetry && (
          <Button type="button" variant="ghost" color="danger" size="tiny" onClick={onRetry}>
            {t('conn.retry')}
          </Button>
        )}
      </Alert>
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
