'use client';

import { useEffect, useState } from 'react';
import { clearPairing, resolvePairing, type PairingInfo } from '@/lib/bridge/pairing';
import { I18nProvider, useT } from '@/lib/i18n/i18n';
import { BridgeProvider, useBridge } from './BridgeProvider';
import { ConnectScreen } from './ConnectScreen';
import { ConnectionBanner } from './ConnectionBanner';
import { Workspace } from './workspace/Workspace';

export function Connected() {
  const { connection, pairing } = useBridge();
  const { t } = useT();
  const failedReason = connection.status === 'failed' ? connection.reason : null;
  const staleToken = failedReason === 'bad-token' || failedReason === 'bad-message';

  // Con un token rechazado, recargar no debe volver a usar el mismo emparejamiento.
  useEffect(() => {
    if (staleToken) clearPairing(window);
  }, [staleToken]);

  if (failedReason) {
    const message = failedReason === 'unreachable' ? t('conn.unreachable', { port: pairing.port }) : t(`conn.${failedReason}`);
    return <ConnectScreen error={message} />;
  }
  return (
    <div className="flex h-full flex-col">
      <ConnectionBanner connection={connection} />
      <Workspace />
    </div>
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
