'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Preflight } from '@sdd-studio/protocol';
import { errorMessage, type WizardClient } from './wizard-client';

export interface PreflightState {
  status: 'loading' | 'ready' | 'error';
  data: Preflight | null;
  error: string | null;
}

export interface PreflightControls extends PreflightState {
  reload(): void;
}

export function usePreflight(client: WizardClient): PreflightControls {
  const [state, setState] = useState<PreflightState>({ status: 'loading', data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const mine = ++latest.current;
    setState({ status: 'loading', data: null, error: null });
    (async () => {
      try {
        const data = Preflight.parse(await client.request({ cmd: 'wizard.preflight' }));
        if (mine === latest.current) setState({ status: 'ready', data, error: null });
      } catch (failure) {
        if (mine === latest.current) setState({ status: 'error', data: null, error: errorMessage(failure) });
      }
    })();
    return () => {
      latest.current += 1;
    };
  }, [client, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, reload };
}
