'use client';

import { RtkGain } from '@sdd-studio/protocol';
import { useCallback, useEffect, useState } from 'react';
import { useBridge } from '../../BridgeProvider';

export type RtkGainState =
  | { status: 'unsupported' }
  | { status: 'offline' }
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; gain: RtkGain };

export function useRtkGain(): { state: RtkGainState; reload: () => void } {
  const { client, connection } = useBridge();
  const open = connection?.status === 'open';
  const supported = client.supports('rtk-gain');
  const [state, setState] = useState<RtkGainState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || !supported) return;
    let cancelled = false;
    setState({ status: 'loading' });
    client
      .request({ cmd: 'kit.rtkGain' })
      .then((raw) => {
        const parsed = RtkGain.safeParse(raw);
        if (!cancelled) setState(parsed.success ? { status: 'ready', gain: parsed.data } : { status: 'failed' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [client, open, supported, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  if (!open) return { state: { status: 'offline' }, reload };
  if (!supported) return { state: { status: 'unsupported' }, reload };
  return { state, reload };
}
