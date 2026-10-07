import type { BotEvent, Presence, ServerEvent, ThreadEvent, ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  applyServerEvent,
  initialState,
  loadHistory,
  setBotHistory,
  setThreads,
  startRun,
  type StudioState,
} from './state';

export interface StudioActions {
  receive(e: ServerEvent): void;
  setSnapshot(s: WorkspaceSnapshot): void;
  setThreads(list: ThreadInfo[]): void;
  loadHistory(threadId: string, entries: { seq: number; event: ThreadEvent }[]): void;
  setPresence(p: Presence[]): void;
  setBotHistory(channelId: string, events: BotEvent[]): void;
  startRun(run: { runId: string; name: string; args: string[] }): void;
}

export type StudioStore = StoreApi<StudioState & StudioActions>;

export function createStudioStore(): StudioStore {
  return createStore<StudioState & StudioActions>()((set) => ({
    ...initialState(),
    receive: (e) => set((s) => applyServerEvent(s, e)),
    setSnapshot: (snapshot) => set({ snapshot }),
    setThreads: (list) => set((s) => setThreads(s, list)),
    loadHistory: (id, entries) => set((s) => loadHistory(s, id, entries)),
    setPresence: (presence) => set({ presence }),
    setBotHistory: (c, events) => set((s) => setBotHistory(s, c, events)),
    startRun: (run) => set((s) => startRun(s, run)),
  }));
}
