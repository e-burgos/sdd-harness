'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { AuthMode, AuthPreference } from '@sdd-studio/protocol';
import { bootstrap } from '@/lib/bootstrap';
import { loadAuthPreference, saveAuthPreference } from '@/lib/auth-preference';
import { clearApiKey, loadApiKey, saveApiKey } from '@/lib/api-key';
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
  /** Effective auth of the bridge (follows auth.set), null until connected. */
  authMode: AuthMode | null;
  /** 'tab' | 'saved' when this browser holds a key, null otherwise. */
  apiKeySource: 'tab' | 'saved' | null;
  setApiKey: (apiKey: string | null, remember: boolean) => Promise<void>;
  /** Which auth tab is in effect for the SDK subprocess, null until the user (or storage) decides. */
  authPreference: AuthPreference | null;
  setAuthPreference: (preference: AuthPreference) => Promise<void>;
}

export const BridgeContext = createContext<BridgeContextValue | null>(null);

export function BridgeProvider({ pairing, children }: { pairing: PairingInfo; children: ReactNode }) {
  const [client] = useState(() => new BridgeClient({ url: bridgeUrl(pairing), token: pairing.token, clientVersion: CLIENT_VERSION }));
  const [store] = useState(createStudioStore);
  const [connection, setConnection] = useState<ConnectionState>(client.state);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [apiKeySource, setApiKeySource] = useState<'tab' | 'saved' | null>(null);

  const [authPreference, setAuthPreferenceState] = useState<AuthPreference | null>(null);

  const pushAuth = useCallback(
    async (apiKey: string | null, mode: AuthPreference) => {
      const result = (await client.request({ cmd: 'auth.set', apiKey, mode })) as { authMode: AuthMode };
      setAuthMode(result.authMode);
    },
    [client],
  );
  const pushApiKey = useCallback((apiKey: string | null) => pushAuth(apiKey, 'api-key'), [pushAuth]);
  const setAuthPreference = useCallback(
    async (preference: AuthPreference) => {
      await pushAuth(preference === 'api-key' ? (loadApiKey()?.apiKey ?? null) : null, preference);
      saveAuthPreference(preference);
      setAuthPreferenceState(preference);
    },
    [pushAuth],
  );
  const setApiKey = useCallback(
    async (apiKey: string | null, remember: boolean) => {
      await pushApiKey(apiKey);
      saveAuthPreference('api-key');
      setAuthPreferenceState('api-key');
      if (apiKey) saveApiKey(apiKey, remember);
      else clearApiKey();
      setApiKeySource(apiKey ? (remember ? 'saved' : 'tab') : null);
    },
    [pushApiKey],
  );

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
      if (s.status === 'open') {
        setAuthMode(s.welcome.authMode);
        // The bridge keeps the key in memory only: hand it back after every (re)connection.
        const stored = loadApiKey();
        setApiKeySource(stored ? (stored.remembered ? 'saved' : 'tab') : null);
        const preference = loadAuthPreference();
        setAuthPreferenceState(preference);
        if (preference === 'subscription') pushAuth(null, 'subscription').catch((e: unknown) => console.error('[sdd-studio] auth.set:', e instanceof Error ? e.message : 'failed'));
        else if (stored) pushApiKey(stored.apiKey).catch((e: unknown) => console.error('[sdd-studio] auth.set:', e instanceof Error ? e.message : 'failed'));
        sync();
      }
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
  }, [client, store, sync, pushApiKey, pushAuth]);

  const value = useMemo(
    () => ({ client, store, connection, pairing, syncError, retrySync: sync, authMode, apiKeySource, setApiKey, authPreference, setAuthPreference }),
    [client, store, connection, pairing, syncError, sync, authMode, apiKeySource, setApiKey, authPreference, setAuthPreference],
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
