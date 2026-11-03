'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BridgeError } from '@/lib/bridge/client';
import { useBridge, useStudio } from '../../BridgeProvider';
import { cycleUsageEntries, fixUsageEntries, type UsageRecord } from './costs-model';

export type CycleRecordsState = { status: 'loading' } | { status: 'ready'; records: UsageRecord[] } | { status: 'error' };

export type CycleRecordsResult = CycleRecordsState & { retry: () => void };

type Reader = (path: string) => Promise<unknown | null>;

async function collectRecords(read: Reader, cycles: { specId: string; cycle: string }[]): Promise<UsageRecord[]> {
  const records: UsageRecord[] = [];
  for (const { specId, cycle } of cycles) {
    const base = `sdd/specs/${specId}/cycles/${cycle}`;
    const [cycleData, tasksData] = await Promise.all([read(`${base}/cycle.json`), read(`${base}/tasks.json`)]);
    for (const entry of cycleUsageEntries(cycleData, tasksData)) records.push({ ...entry, origin: `${specId}/${cycle}` });
  }
  const fixesData = (await read('sdd/fixes.json')) as { fixes?: { id?: string }[] } | null;
  for (const fix of fixesData?.fixes ?? []) {
    for (const entry of fixUsageEntries(fix)) records.push({ ...entry, origin: fix.id ?? 'fix' });
  }
  return records;
}

export function useCycleRecords(): CycleRecordsResult {
  const { client, connection } = useBridge();
  const connectionStatus = connection.status;
  const [attempt, setAttempt] = useState(0);
  const snapshot = useStudio((s) => s.snapshot);
  const latestCycles = useRef<{ specId: string; cycle: string }[]>([]);
  latestCycles.current = (snapshot?.cycles ?? []).map(({ specId, cycle }) => ({ specId, cycle }));
  const [state, setState] = useState<CycleRecordsState>({ status: 'loading' });
  const signature = useMemo(() => JSON.stringify([(snapshot?.cycles ?? []).map((c) => [c.specId, c.cycle, c.status, c.tasksDone]), (snapshot?.fixes ?? []).map((f) => [f.id, f.status])]), [snapshot]);

  useEffect(() => {
    let cancelled = false;
    const read: Reader = async (path) => {
      try {
        const result = (await client.request({ cmd: 'workspace.readFile', path })) as { content: string };
        return JSON.parse(result.content) as unknown;
      } catch (error) {
        if (error instanceof BridgeError && error.code === 'not-found') return null;
        throw error;
      }
    };
    setState({ status: 'loading' });
    collectRecords(read, latestCycles.current)
      .then((records) => {
        if (!cancelled) setState({ status: 'ready', records });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [client, signature, connectionStatus, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
