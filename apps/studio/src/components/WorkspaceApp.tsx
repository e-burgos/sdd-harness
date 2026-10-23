'use client';

import { useEffect, useState } from 'react';
import { clearPairing, resolvePairing, type PairingInfo } from '@/lib/bridge/pairing';
import { I18nProvider, useT } from '@/lib/i18n/i18n';
import { AppShell } from './AppShell';
import { BridgeProvider, useBridge } from './BridgeProvider';
import { ConnectScreen } from './ConnectScreen';
import { ConnectionBanner } from './ConnectionBanner';
import { Workspace } from './workspace/Workspace';

export function Connected() {
  const { connection, pairing, syncError, retrySync } = useBridge();
  const { t } = useT();
  const failedReason = connection.status === 'failed' ? connection.reason : null;
  const mismatchHint = connection.status === 'failed' ? connection.hint : undefined;
  const staleToken = failedReason === 'bad-token' || failedReason === 'bad-message';

  // Con un token rechazado, recargar no debe volver a usar el mismo emparejamiento.
  useEffect(() => {
    if (staleToken) clearPairing(window);
  }, [staleToken]);

  if (failedReason) {
    const message =
      failedReason === 'unreachable'
        ? t('conn.unreachable', { port: pairing.port })
        : failedReason === 'protocol-mismatch' && mismatchHint === 'web-older'
          ? t('conn.protocol-mismatch.web-older')
          : t(`conn.${failedReason}`);
    return <ConnectScreen error={message} />;
  }
  return (
    <AppShell>
      <ConnectionBanner connection={connection} syncError={syncError} onRetry={retrySync} />
      <Workspace />
    </AppShell>
  );
}

export function WorkspaceApp() {
  const [pairing, setPairing] = useState<PairingInfo | null | undefined>(undefined);
  useEffect(() => setPairing(resolvePairing(window)), []);
  return (
    <I18nProvider>
      {pairing === undefined ? null : pairing === null ? (
        <ConnectScreen />
      ) : (
        <BridgeProvider pairing={pairing}>
          <Connected />
        </BridgeProvider>
      )}
    </I18nProvider>
  );
}
