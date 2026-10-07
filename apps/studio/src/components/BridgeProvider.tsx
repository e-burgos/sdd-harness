'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { bootstrap } from '@/lib/bootstrap';
import { BridgeClient, BridgeError, type ConnectionState } from '@/lib/bridge/client';
import { bridgeUrl, type PairingInfo } from '@/lib/bridge/pairing';
import type { StudioState } from '@/lib/store/state';
import { createStudioStore, type StudioActions, type StudioStore } from '@/lib/store/store';

const CLIENT_VERSION = '0.1.0';

export interface BridgeContextValue {
  client: BridgeClient;
  store: StudioStore;
  connection: ConnectionState;
  pairing: PairingInfo;
  syncError: string | null;
  retrySync: () => void;
}

export const BridgeContext = createContext<BridgeContextValue | null>(null);

export function BridgeProvider({ pairing, children }: { pairing: PairingInfo; children: ReactNode }) {
  const [client] = useState(() => new BridgeClient({ url: bridgeUrl(pairing), token: pairing.token, clientVersion: CLIENT_VERSION }));
  const [store] = useState(createStudioStore);
  const [connection, setConnection] = useState<ConnectionState>(client.state);
  const [syncError, setSyncError] = useState<string | null>(null);

  const runRef = useRef(0);

  const sync = useCallback(() => {
    const run = ++runRef.current;
    bootstrap(client, store).then(
      () => {
        if (run === runRef.current) setSyncError(null);
      },
      (error: unknown) => {
        if (run !== runRef.current) return;
        if (error instanceof BridgeError && error.code === 'disconnected') return;
        console.error('[sdd-studio] bootstrap:', error);
        setSyncError(error instanceof Error ? error.message : String(error));
      },
    );
  }, [client, store]);

  useEffect(() => {
    const offState = client.onState((s) => {
      setConnection(s);
      if (s.status === 'open') sync();
      else {
        runRef.current++; // invalida cualquier sync en vuelo
        setSyncError(null);
      }
    });
    const offEvents = client.onEvent((e) => store.getState().receive(e));
    client.connect();
    return () => {
      offState();
      offEvents();
      client.close();
    };
  }, [client, store, sync]);

  const value = useMemo(
    () => ({ client, store, connection, pairing, syncError, retrySync: sync }),
    [client, store, connection, pairing, syncError, sync],
  );
  return <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>;
}

export function useBridge(): BridgeContextValue {
  const value = useContext(BridgeContext);
  if (!value) throw new Error('useBridge must be used inside <BridgeProvider>');
  return value;
}

export function useStudio<T>(selector: (s: StudioState & StudioActions) => T): T {
  return useStore(useBridge().store, selector);
}
