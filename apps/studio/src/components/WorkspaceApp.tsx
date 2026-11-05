'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { clearPairing, resolvePairing, type PairingInfo } from '@/lib/bridge/pairing';
import { I18nProvider, useT } from '@/lib/i18n/i18n';
import { NavProvider, useNav, type KnownEntities } from '@/lib/nav/use-nav';
import { AppShell } from './AppShell';
import { ErrorBoundary } from './ErrorBoundary';
import { BridgeProvider, useBridge, useStudio } from './BridgeProvider';
import { ConnectScreen } from './ConnectScreen';
import { ConnectionBanner } from './ConnectionBanner';
import { StudioHeader } from './StudioHeader';
import { LauncherShell } from './shell/LauncherShell';
import { StudioShell } from './shell/StudioShell';

export function Connected() {
  const { connection, pairing } = useBridge();
  const { t } = useT();
  const failedReason = connection.status === 'failed' ? connection.reason : null;
  const mismatchHint = connection.status === 'failed' ? connection.hint : undefined;
  const staleToken = failedReason === 'bad-token' || failedReason === 'bad-message';

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

  return <ConnectedShell />;
}

export function WorkspaceArrival() {
  const { workspaceEpoch } = useBridge();
  const openHome = useNav((s) => s.openHome);
  const handled = useRef(workspaceEpoch ?? 0);
  useEffect(() => {
    if (workspaceEpoch === undefined || workspaceEpoch === handled.current) return;
    handled.current = workspaceEpoch;
    openHome({ kind: 'channel', channelId: 'general' });
  }, [workspaceEpoch, openHome]);
  return null;
}

function ConnectedShell() {
  const { connection, syncError, retrySync, workspaceMode, switching, retrySwitch } = useBridge();
  const launcher = connection.status === 'open' ? connection.welcome?.workspace === null : workspaceMode === 'launcher';
  const snapshot = useStudio((s) => s.snapshot);
  const welcomeProject = connection.status === 'open' ? connection.welcome?.workspace?.project : undefined;
  const project = snapshot?.project ?? welcomeProject ?? '';
  const known = useMemo<KnownEntities | null>(
    () =>
      snapshot
        ? { specs: snapshot.specs.map((spec) => spec.id), fixes: snapshot.fixes.map((fix) => fix.id), agents: snapshot.agents.map((agent) => agent.id) }
        : null,
    [snapshot],
  );
  return (
    <NavProvider project={project} known={known}>
      <WorkspaceArrival />
      <AppShell>
        <StudioHeader launcher={launcher} />
        <ConnectionBanner connection={connection} syncError={syncError} onRetry={retrySync} switching={switching} onRetrySwitch={retrySwitch} />
        {launcher ? <LauncherShell /> : <StudioShell />}
      </AppShell>
    </NavProvider>
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
