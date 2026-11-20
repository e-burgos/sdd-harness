'use client';

import { ClaudeBrowserOpenSettingsResult, ClaudeBrowserStatus } from '@sdd-studio/protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBridge } from '../../BridgeProvider';

export const RECHECK_AFTER_SETTINGS_MS = 4000;

export interface ChromeStatusValue {
  supported: boolean;
  status: ClaudeBrowserStatus | null;
  checking: boolean;
  check: () => Promise<void>;
  openSettings: () => Promise<void>;
}

export function useChromeStatus(): ChromeStatusValue {
  const { client, connection } = useBridge();
  const supported = connection.status === 'open' && typeof client.supports === 'function' && client.supports('claude-connect');
  const [status, setStatus] = useState<ClaudeBrowserStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const parsed = ClaudeBrowserStatus.safeParse(await client.request({ cmd: 'claude.browser.check' }));
      if (parsed.success) setStatus(parsed.data);
    } catch {
      return;
    } finally {
      setChecking(false);
    }
  }, [client]);

  useEffect(() => {
    if (!supported) {
      setStatus(null);
      return;
    }
    void check();
    const stop =
      typeof client.onEvent === 'function'
        ? client.onEvent((event) => {
            if (event.kind !== 'bot.event' || event.botKind !== 'claude-browser.changed') return;
            const parsed = ClaudeBrowserStatus.safeParse(event.payload);
            if (parsed.success) setStatus(parsed.data);
          })
        : undefined;
    return () => {
      stop?.();
      clearTimeout(timer.current);
    };
  }, [client, supported, check]);

  const openSettings = useCallback(async () => {
    try {
      ClaudeBrowserOpenSettingsResult.safeParse(await client.request({ cmd: 'claude.browser.openSettings' }));
    } catch {
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void check(), RECHECK_AFTER_SETTINGS_MS);
  }, [client, check]);

  return { supported, status, checking, check, openSettings };
}
