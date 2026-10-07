'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { bootstrap } from '@/lib/bootstrap';
import { BridgeClient, type ConnectionState } from '@/lib/bridge/client';
import { bridgeUrl, type PairingInfo } from '@/lib/bridge/pairing';
import type { StudioState } from '@/lib/store/state';
import { createStudioStore, type StudioActions, type StudioStore } from '@/lib/store/store';

const CLIENT_VERSION = '0.1.0';

export interface BridgeContextValue {
  client: BridgeClient;
  store: StudioStore;
  connection: ConnectionState;
  pairing: PairingInfo;
}

export const BridgeContext = createContext<BridgeContextValue | null>(null);

export function BridgeProvider({ pairing, children }: { pairing: PairingInfo; children: ReactNode }) {
  const [client] = useState(() => new BridgeClient({ url: bridgeUrl(pairing), token: pairing.token, clientVersion: CLIENT_VERSION }));
  const [store] = useState(createStudioStore);
  const [connection, setConnection] = useState<ConnectionState>(client.state);

  useEffect(() => {
    const offState = client.onState((s) => {
      setConnection(s);
      if (s.status === 'open') void bootstrap(client, store).catch((error) => console.error('[sdd-studio] bootstrap:', error));
    });
    const offEvents = client.onEvent((e) => store.getState().receive(e));
    client.connect();
    return () => {
      offState();
      offEvents();
      client.close();
    };
  }, [client, store]);

  const value = useMemo(() => ({ client, store, connection, pairing }), [client, store, connection, pairing]);
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
