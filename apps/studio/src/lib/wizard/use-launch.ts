'use client';

import { useCallback, useRef, useState } from 'react';
import { GenerateResult, type GenerationState, type TargetCheck } from '@sdd-studio/protocol';
import type { HarnessConfigDraft } from './to-config';
import { errorCode, errorMessage, type WizardClient } from './wizard-client';

export type LaunchNotice =
  | { kind: 'blocked'; reason: string | null }
  | { kind: 'invalid-config' }
  | { kind: 'conflict'; message: string }
  | { kind: 'error'; message: string };

export interface PendingConfirmation {
  check: TargetCheck;
  changed: boolean;
}

export interface LaunchControls {
  starting: boolean;
  confirmation: PendingConfirmation | null;
  notice: LaunchNotice | null;
  start(config: HarnessConfigDraft, path: string, check: TargetCheck): void;
  confirm(): void;
  cancelConfirmation(): void;
}

interface Pending {
  config: HarnessConfigDraft;
  path: string;
}

export function useLaunch(client: WizardClient, adopt: (generation: GenerationState) => void): LaunchControls {
  const [starting, setStarting] = useState(false);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const [notice, setNotice] = useState<LaunchNotice | null>(null);
  const pending = useRef<Pending | null>(null);
  const busy = useRef(false);

  const send = useCallback(
    async (fingerprint: string | null) => {
      const job = pending.current;
      if (job === null || busy.current) return;
      busy.current = true;
      setStarting(true);
      setNotice(null);
      try {
        const result = GenerateResult.parse(
          await client.request({ cmd: 'wizard.generate', config: job.config, path: job.path, ...(fingerprint === null ? {} : { fingerprint }) }),
        );
        switch (result.outcome) {
          case 'started':
            setConfirmation(null);
            adopt(result.generation);
            break;
          case 'needs-confirmation':
            setConfirmation({ check: result.check, changed: fingerprint !== null });
            break;
          case 'blocked':
            setConfirmation(null);
            setNotice({ kind: 'blocked', reason: result.reason });
            break;
          case 'invalid-config':
            setConfirmation(null);
            setNotice({ kind: 'invalid-config' });
            break;
        }
      } catch (failure) {
        setConfirmation(null);
        setNotice(errorCode(failure) === 'conflict' ? { kind: 'conflict', message: errorMessage(failure) } : { kind: 'error', message: errorMessage(failure) });
      } finally {
        busy.current = false;
        setStarting(false);
      }
    },
    [client, adopt],
  );

  const start = useCallback(
    (config: HarnessConfigDraft, path: string, check: TargetCheck) => {
      pending.current = { config, path };
      if (check.needsConfirmation) {
        setNotice(null);
        setConfirmation({ check, changed: false });
        return;
      }
      void send(null);
    },
    [send],
  );

  const confirm = useCallback(() => {
    if (confirmation !== null) void send(confirmation.check.fingerprint);
  }, [confirmation, send]);

  const cancelConfirmation = useCallback(() => setConfirmation(null), []);

  return { starting, confirmation, notice, start, confirm, cancelConfirmation };
}
