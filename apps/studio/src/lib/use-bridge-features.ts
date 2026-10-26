'use client';

import { useMemo } from 'react';
import { useBridge } from '@/components/BridgeProvider';

export type BridgeCapability = 'session-title' | 'link-targets' | 'document-touched';

export interface BridgeFeatures {
  supports(capability: BridgeCapability): boolean;
  missing(capabilities: readonly BridgeCapability[]): BridgeCapability[];
}

export function useBridgeFeatures(): BridgeFeatures {
  const { client, connection } = useBridge();
  const open = connection?.status === 'open';
  return useMemo(() => {
    const supports = (capability: BridgeCapability) => client.supports(capability);
    return {
      supports,
      missing: (capabilities) => (open ? capabilities.filter((c) => !supports(c)) : []),
    };
  }, [client, open]);
}
