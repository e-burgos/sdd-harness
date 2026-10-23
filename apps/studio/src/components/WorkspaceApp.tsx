'use client';

import { useEffect, useState } from 'react';
import { channelForDm } from '@sdd-studio/protocol';
import { clearPairing, resolvePairing, type PairingInfo } from '@/lib/bridge/pairing';
import { I18nProvider, useT } from '@/lib/i18n/i18n';
import { useStudioView } from '@/lib/use-studio-view';
import { AppShell } from './AppShell';
import { ErrorBoundary } from './ErrorBoundary';
import { BridgeProvider, useBridge } from './BridgeProvider';
import { ConnectScreen } from './ConnectScreen';
import { ConnectionBanner } from './ConnectionBanner';
import { StudioHeader } from './StudioHeader';
import { Workspace } from './workspace/Workspace';
import { AgentMapCanvas } from './mission-control/AgentMapCanvas';
import { EcosystemDashboard } from './mission-control/EcosystemDashboard';
import { LiveTelemetryHUD } from './mission-control/LiveTelemetryHUD';

export function Connected() {
  const { connection, pairing, syncError, retrySync } = useBridge();
  const { t } = useT();
  const { activeView, setActiveView } = useStudioView();
  const [selectedChannelId, setSelectedChannelId] = useState<string | undefined>(undefined);
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

  const handleOpenDm = (agent: string) => {
    setSelectedChannelId(channelForDm(agent));
    setActiveView('workspace');
  };

  return (
    <AppShell>
      <StudioHeader activeView={activeView} onSelectView={setActiveView} />
      <ConnectionBanner connection={connection} syncError={syncError} onRetry={retrySync} />
      <div className={`flex flex-1 min-h-0 ${activeView === 'workspace' ? '' : 'hidden'}`}>
        <Workspace selectedChannelId={selectedChannelId} />
      </div>
      {activeView === 'agent-map' && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <AgentMapCanvas onOpenDm={handleOpenDm} />
        </div>
      )}
      {activeView === 'ecosystem' && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <EcosystemDashboard />
        </div>
      )}
      {activeView === 'telemetry' && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <LiveTelemetryHUD />
        </div>
      )}
    </AppShell>
  );
}

export function WorkspaceApp() {
  const [pairing, setPairing] = useState<PairingInfo | null | undefined>(undefined);
  useEffect(() => setPairing(resolvePairing(window)), []);
  return (
    <I18nProvider>
      <ErrorBoundary>
        {pairing === undefined ? null : pairing === null ? (
          <ConnectScreen />
        ) : (
          <BridgeProvider pairing={pairing}>
            <Connected />
          </BridgeProvider>
        )}
      </ErrorBoundary>
    </I18nProvider>
  );
}
