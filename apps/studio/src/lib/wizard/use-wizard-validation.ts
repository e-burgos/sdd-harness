'use client';

import { useCallback } from 'react';
import { ConfigValidation } from '@sdd-studio/protocol';
import { issuesBlockGeneration } from './issues';
import type { HarnessConfigDraft } from './to-config';
import { useLatestRequest, WIZARD_DEBOUNCE_MS } from './use-latest-request';
import type { WizardClient } from './wizard-client';

export interface WizardValidation {
  status: 'idle' | 'validating' | 'ready' | 'error';
  validation: ConfigValidation | null;
  error: string | null;
  canGenerate: boolean;
}

export function useWizardValidation(
  client: WizardClient,
  config: HarnessConfigDraft | null,
  debounceMs: number = WIZARD_DEBOUNCE_MS,
): WizardValidation {
  const run = useCallback(
    async (draft: HarnessConfigDraft) => ConfigValidation.parse(await client.request({ cmd: 'wizard.validate', config: draft })),
    [client],
  );
  const result = useLatestRequest(config, run, debounceMs);
  const validation = result.status === 'ready' ? result.data : null;
  return {
    status: result.status === 'pending' ? 'validating' : result.status,
    validation,
    error: result.error,
    canGenerate: result.status === 'ready' && validation !== null && !issuesBlockGeneration(validation.issues),
  };
}
