import { BotEvent, Presence, ThreadEvent, ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { z } from 'zod';
import type { BridgeClient } from './bridge/client';
import type { StudioStore } from './store/store';

type Requester = Pick<BridgeClient, 'request'> & Partial<Pick<BridgeClient, 'supports'>>;
const History = z.array(z.object({ seq: z.number().int().nonnegative(), event: ThreadEvent }));

/**
 * Syncs a thread: marks the start of the sync (live events are buffered)
 * and requests history from lastSeq+1. On failure the thread stays unsynced
 * and is retried on the next open/bootstrap.
 */
export async function openThread(client: Requester, store: StudioStore, threadId: string): Promise<void> {
  store.getState().beginSync(threadId);
  const sinceSeq = (store.getState().threads[threadId]?.lastSeq ?? -1) + 1;
  const includeDocumentTouched = client.supports?.('document-touched') === true;
  const entries = History.parse(
    await client.request({ cmd: 'thread.history', threadId, sinceSeq, ...(includeDocumentTouched ? { includeDocumentTouched } : {}) }),
  );
  store.getState().loadHistory(threadId, entries);
}

export async function loadBotHistory(client: Requester, store: StudioStore, channelId: string): Promise<void> {
  const events = z.array(BotEvent).parse(await client.request({ cmd: 'channel.botHistory', channelId, limit: 100 }));
  store.getState().setBotHistory(channelId, events);
}

/** Initial load (and re-sync after reconnecting). */
export async function bootstrap(client: Requester, store: StudioStore): Promise<void> {
  // Synchronous, before the first await: live events arriving while
  // snapshot/list/presence are requested are buffered instead of opening a seq gap.
  const known = Object.entries(store.getState().threads)
    .filter(([, t]) => t.synced || t.lastSeq >= 0)
    .map(([id]) => id);
  for (const id of known) store.getState().beginSync(id);
  const [snapshot, threads, presence] = await Promise.all([
    client.request({ cmd: 'workspace.snapshot' }),
    client.request({ cmd: 'thread.list' }),
    client.request({ cmd: 'presence.get' }),
  ]);
  const state = store.getState();
  state.setSnapshot(WorkspaceSnapshot.parse(snapshot));
  state.setThreads(z.array(ThreadInfo).parse(threads));
  state.setPresence(z.array(Presence).parse(presence));
  await Promise.all(known.map((id) => openThread(client, store, id)));
}
