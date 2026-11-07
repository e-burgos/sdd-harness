'use client';

import { useEffect } from 'react';
import { useBridge } from '@/components/BridgeProvider';
import { useSubscription } from './use-subscription';

export const CLAUDE_STATUS_POLL_MS = 3000;

export function useClaudeConnected(watching = false): { connected: boolean; refresh(): Promise<void> } {
  const { client, authMode, connection } = useBridge();
  const apiKey = authMode === 'api-key';
  const open = connection?.status === 'open';
  const { account, refresh } = useSubscription(client, open && !apiKey);
  useEffect(() => {
    if (!watching || apiKey || !open) return;
    const timer = setInterval(() => void refresh(), CLAUDE_STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [watching, apiKey, open, refresh]);
  return { connected: apiKey || account?.state === 'connected', refresh };
}
