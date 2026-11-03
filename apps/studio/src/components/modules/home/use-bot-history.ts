'use client';

import { useEffect } from 'react';
import type { StudioStore } from '@/lib/store/store';
import { loadBotHistory } from '@/lib/bootstrap';
import { useBridge } from '../../BridgeProvider';

const CONCURRENCY = 4;
const requested = new WeakMap<StudioStore, Set<string>>();

export function useBotHistory(channelIds: readonly string[]): void {
  const { client, store, connection } = useBridge();
  const key = channelIds.join('|');
  const open = connection.status === 'open';
  useEffect(() => {
    if (!open) return;
    const seen = requested.get(store) ?? new Set<string>();
    requested.set(store, seen);
    const pending = channelIds.filter((id) => !seen.has(id));
    pending.forEach((id) => seen.add(id));
    const queue = [...pending];
    const worker = async () => {
      for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
        await loadBotHistory(client, store, id).catch(() => seen.delete(id));
      }
    };
    void Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  }, [client, store, open, key]);
}
