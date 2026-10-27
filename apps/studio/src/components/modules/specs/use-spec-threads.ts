'use client';

import { useMemo } from 'react';
import type { ThreadInfo } from '@sdd-studio/protocol';
import { useStudio } from '../../BridgeProvider';
import { threadsOfSpec } from './specs-model';

export function useSpecThreads(specId: string): ThreadInfo[] {
  const threads = useStudio((s) => s.threads);
  return useMemo(() => threadsOfSpec(Object.values(threads).flatMap((state) => (state.info ? [state.info] : [])), specId), [threads, specId]);
}
