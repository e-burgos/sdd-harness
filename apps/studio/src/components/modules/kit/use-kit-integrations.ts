'use client';

import { KIT_INTEGRATIONS, KitIntegrationSetResult, KitIntegrationStatus, type KitIntegrationId } from '@sdd-studio/protocol';
import { useCallback, useEffect, useState } from 'react';
import { useBridge } from '../../BridgeProvider';

export interface IntegrationEntry {
  status: KitIntegrationStatus | null;
  loading: boolean;
  loadFailed: boolean;
  busy: 'on' | 'off' | null;
  failure: { output: string } | null;
}

const EMPTY_ENTRY: IntegrationEntry = { status: null, loading: true, loadFailed: false, busy: null, failure: null };

const initialEntries = (): Record<KitIntegrationId, IntegrationEntry> => ({ 'tucu-ui': EMPTY_ENTRY, 'video-maker': EMPTY_ENTRY });

export function useKitIntegrations() {
  const { client, connection } = useBridge();
  const supported = client.supports('kit-integrations');
  const open = connection.status === 'open';
  const [entries, setEntries] = useState(initialEntries);

  const patch = useCallback((id: KitIntegrationId, change: Partial<IntegrationEntry>) => {
    setEntries((current) => ({ ...current, [id]: { ...current[id], ...change } }));
  }, []);

  useEffect(() => {
    if (!supported || !open) return;
    let cancelled = false;
    for (const id of KIT_INTEGRATIONS) {
      client
        .request({ cmd: 'kit.integration.status', integration: id })
        .then((raw) => {
          const parsed = KitIntegrationStatus.safeParse(raw);
          if (!cancelled) patch(id, parsed.success ? { status: parsed.data, loading: false, loadFailed: false } : { loading: false, loadFailed: true });
        })
        .catch(() => {
          if (!cancelled) patch(id, { loading: false, loadFailed: true });
        });
    }
    return () => {
      cancelled = true;
    };
  }, [client, supported, open, patch]);

  const toggle = useCallback(
    async (id: KitIntegrationId, enabled: boolean) => {
      patch(id, { busy: enabled ? 'on' : 'off', failure: null });
      try {
        const parsed = KitIntegrationSetResult.safeParse(await client.request({ cmd: 'kit.integration.set', integration: id, enabled }));
        if (!parsed.success) {
          patch(id, { busy: null, failure: { output: '' } });
          return;
        }
        patch(id, { busy: null, status: parsed.data.status, loadFailed: false, failure: parsed.data.ok ? null : { output: parsed.data.output } });
      } catch (error) {
        patch(id, { busy: null, failure: { output: error instanceof Error ? error.message : '' } });
      }
    },
    [client, patch],
  );

  return { supported, open, entries, toggle };
}
