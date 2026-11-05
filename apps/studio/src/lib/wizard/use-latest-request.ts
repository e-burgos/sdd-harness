'use client';

import { useEffect, useRef, useState } from 'react';
import { errorMessage } from './wizard-client';

export const WIZARD_DEBOUNCE_MS = 400;

export interface LatestRequestState<O> {
  status: 'idle' | 'pending' | 'ready' | 'error';
  data: O | null;
  error: string | null;
}

interface Job<I> {
  input: I;
  version: number;
}

interface Scheduler<I> {
  version: number;
  counter: number;
  inFlight: boolean;
  queued: Job<I> | null;
  mounted: boolean;
}

const IDLE: LatestRequestState<never> = { status: 'idle', data: null, error: null };

export function useLatestRequest<I, O>(
  input: I | null,
  run: (input: I) => Promise<O>,
  debounceMs: number = WIZARD_DEBOUNCE_MS,
): LatestRequestState<O> {
  const [state, setState] = useState<LatestRequestState<O>>(IDLE);
  const runRef = useRef(run);
  runRef.current = run;
  const scheduler = useRef<Scheduler<I>>({ version: 0, counter: 0, inFlight: false, queued: null, mounted: true });
  const key = input === null ? null : JSON.stringify(input);

  useEffect(() => {
    const s = scheduler.current;
    s.mounted = true;
    return () => {
      s.mounted = false;
    };
  }, []);

  useEffect(() => {
    const s = scheduler.current;
    const version = ++s.version;
    if (input === null) {
      s.queued = null;
      setState(IDLE);
      return;
    }
    setState((previous) => ({ ...previous, status: 'pending' }));

    const dispatch = (job: Job<I>): void => {
      s.inFlight = true;
      const seq = ++s.counter;
      const finish = (next: LatestRequestState<O>): void => {
        s.inFlight = false;
        if (!s.mounted) return;
        if (s.queued) {
          const queued = s.queued;
          s.queued = null;
          dispatch(queued);
          return;
        }
        if (job.version === s.version && seq === s.counter) setState(next);
      };
      runRef.current(job.input).then(
        (data) => finish({ status: 'ready', data, error: null }),
        (error: unknown) => finish({ status: 'error', data: null, error: errorMessage(error) }),
      );
    };

    const timer = setTimeout(() => {
      const job: Job<I> = { input, version };
      if (s.inFlight) s.queued = job;
      else dispatch(job);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [key, debounceMs]);

  return state;
}
