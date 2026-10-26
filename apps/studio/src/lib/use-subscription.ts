'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthAccount } from '@sdd-studio/protocol';
import type { BridgeClient } from '@/lib/bridge/client';

export const SUBSCRIPTION_POLL_MS = 2000;

export interface SubscriptionControls {
  account: AuthAccount | null;
  busy: boolean;
  failure: string | null;
  login(): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
}

export function useSubscription(client: BridgeClient, enabled: boolean): SubscriptionControls {
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const call = useCallback(
    async (cmd: 'auth.status' | 'auth.login' | 'auth.logout') => {
      try {
        const next = AuthAccount.parse(await client.request({ cmd }));
        if (!alive.current) return;
        setAccount(next);
        setFailure(null);
      } catch (e) {
        if (alive.current) setFailure(e instanceof Error ? e.message : String(e));
      }
    },
    [client],
  );

  const run = useCallback(
    async (cmd: 'auth.login' | 'auth.logout') => {
      setBusy(true);
      await call(cmd);
      if (alive.current) setBusy(false);
    },
    [call],
  );

  const refresh = useCallback(() => call('auth.status'), [call]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  const pending = account?.state === 'pending';
  useEffect(() => {
    if (!enabled || !pending) return;
    const timer = setInterval(() => void refresh(), SUBSCRIPTION_POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, pending, refresh]);

  const login = useCallback(() => run('auth.login'), [run]);
  const logout = useCallback(() => run('auth.logout'), [run]);
  return { account, busy, failure, login, logout, refresh };
}
