'use client';

import { useCallback } from 'react';
import { TargetCheck } from '@sdd-studio/protocol';
import { useLatestRequest, WIZARD_DEBOUNCE_MS } from './use-latest-request';
import type { WizardClient } from './wizard-client';

export interface TargetCheckState {
  status: 'idle' | 'checking' | 'ready' | 'error';
  check: TargetCheck | null;
  error: string | null;
}

export function useTargetCheck(client: WizardClient, path: string, debounceMs: number = WIZARD_DEBOUNCE_MS): TargetCheckState {
  const trimmed = path.trim();
  const run = useCallback(
    async (target: string) => TargetCheck.parse(await client.request({ cmd: 'wizard.checkTarget', path: target })),
    [client],
  );
  const result = useLatestRequest(trimmed === '' ? null : trimmed, run, debounceMs);
  return {
    status: result.status === 'pending' ? 'checking' : result.status,
    check: result.status === 'ready' ? result.data : null,
    error: result.error,
  };
}
