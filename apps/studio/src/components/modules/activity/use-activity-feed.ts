'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BotEvent } from '@sdd-studio/protocol';
import { z } from 'zod';
import type { StudioStore } from '@/lib/store/store';
import { useBridge, useStudio } from '../../BridgeProvider';
import { buildActivity, type ActivityEntry } from './activity-model';

const CONCURRENCY = 4;
const HISTORY_LIMIT = 100;
const requested = new WeakMap<StudioStore, Set<string>>();

export type ActivityFeedStatus = 'loading' | 'ready' | 'error';

export interface ActivityFeed {
  entries: ActivityEntry[];
  status: ActivityFeedStatus;
  retry(): void;
}

export function useActivityFeedLoader(enabled: boolean): ActivityFeed {
  const { client, store, connection } = useBridge();
  const specs = useStudio((s) => s.snapshot?.specs);
  const bot = useStudio((s) => s.bot);
  const threads = useStudio((s) => s.threads);
  const [status, setStatus] = useState<ActivityFeedStatus>('loading');
  const [attempt, setAttempt] = useState(0);
  const open = connection.status === 'open';
  const channelIds = useMemo(() => ['general', 'fixes', ...(specs ?? []).map((spec) => `spec:${spec.id}`)], [specs]);
  const key = channelIds.join('|');

  useEffect(() => {
    if (!enabled || !open || specs === undefined) return;
    const seen = requested.get(store) ?? new Set<string>();
    requested.set(store, seen);
    const queue = channelIds.filter((id) => !seen.has(id));
    queue.forEach((id) => seen.add(id));
    if (queue.length === 0) {
      setStatus('ready');
      return;
    }
    let cancelled = false;
    let failed = false;
    setStatus('loading');
    const includeKitEvents = client.supports?.('kit-tools') === true;
    const load = async (channelId: string) => {
      const request = { cmd: 'channel.botHistory' as const, channelId, limit: HISTORY_LIMIT, ...(channelId === 'general' && includeKitEvents ? { includeKitEvents } : {}) };
      const events = z.array(BotEvent).parse(await client.request(request));
      store.getState().setBotHistory(channelId, events);
    };
    const worker = async () => {
      for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
        const channelId = id;
        await load(channelId).catch(() => {
          seen.delete(channelId);
          failed = true;
        });
      }
    };
    void Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker)).then(() => {
      if (!cancelled) setStatus(failed ? 'error' : 'ready');
    });
    return () => {
      cancelled = true;
    };
  }, [client, store, enabled, open, specs === undefined, key, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const entries = useMemo(() => buildActivity(bot, threads), [bot, threads]);
  return useMemo(() => ({ entries, status, retry }), [entries, status, retry]);
}
