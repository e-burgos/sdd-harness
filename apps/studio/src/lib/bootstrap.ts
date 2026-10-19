import { BotEvent, Presence, ThreadEvent, ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { z } from 'zod';
import type { BridgeClient } from './bridge/client';
import type { StudioStore } from './store/store';

type Requester = Pick<BridgeClient, 'request'>;
const History = z.array(z.object({ seq: z.number().int().nonnegative(), event: ThreadEvent }));

/**
 * Sincroniza un hilo: marca el inicio del sync (los eventos en vivo se bufferean)
 * y pide el historial desde lastSeq+1. Si falla, el hilo queda sin sincronizar
 * y se reintenta en la próxima apertura/bootstrap.
 */
export async function openThread(client: Requester, store: StudioStore, threadId: string): Promise<void> {
  store.getState().beginSync(threadId);
  const sinceSeq = (store.getState().threads[threadId]?.lastSeq ?? -1) + 1;
  const entries = History.parse(await client.request({ cmd: 'thread.history', threadId, sinceSeq }));
  store.getState().loadHistory(threadId, entries);
}

export async function loadBotHistory(client: Requester, store: StudioStore, channelId: string): Promise<void> {
  const events = z.array(BotEvent).parse(await client.request({ cmd: 'channel.botHistory', channelId, limit: 100 }));
  store.getState().setBotHistory(channelId, events);
}

/** Carga inicial (y re-sincronización tras reconectar). */
export async function bootstrap(client: Requester, store: StudioStore): Promise<void> {
  // Sincrónico, antes del primer await: los eventos en vivo que lleguen mientras
  // se piden snapshot/lista/presencia se bufferean en vez de abrir un hueco de seq.
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
