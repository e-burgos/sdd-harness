'use client';

import { useMemo } from 'react';
import type { BotEvent, FixSummary, ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { useNav } from '@/lib/nav/use-nav';
import { useStudio } from '../../BridgeProvider';

export interface FixesData {
  snapshot: WorkspaceSnapshot | null;
  fixes: FixSummary[];
  selectedId: string | null;
  selected: FixSummary | null;
  threads: ThreadInfo[];
  events: BotEvent[];
}

const NO_EVENTS: BotEvent[] = [];

export function useFixes(): FixesData {
  const snapshot = useStudio((s) => s.snapshot);
  const threadStates = useStudio((s) => s.threads);
  const events = useStudio((s) => s.bot['fixes']) ?? NO_EVENTS;
  const selectedId = useNav((s) => s.selection.fixes);
  const fixes = useMemo(() => snapshot?.fixes ?? [], [snapshot]);
  const threads = useMemo(() => Object.values(threadStates).flatMap((state) => (state.info ? [state.info] : [])), [threadStates]);
  const selected = useMemo(() => fixes.find((fix) => fix.id === selectedId) ?? null, [fixes, selectedId]);
  return { snapshot, fixes, selectedId, selected, threads, events };
}
