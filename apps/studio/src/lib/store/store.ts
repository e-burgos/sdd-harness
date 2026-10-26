import type { BotEvent, Presence, ServerEvent, ThreadEvent, ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import type { DraftAttachment } from '../attachments/draft-attachment';
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  applyServerEvent,
  initialState,
  beginSync,
  loadHistory,
  setBotHistory,
  clearDraft,
  dismissPrepared,
  openPrepared,
  setDraftAttachments,
  setDraftText,
  setThreads,
  startRun,
  type StudioState,
} from './state';

export interface StudioActions {
  receive(e: ServerEvent): void;
  setSnapshot(s: WorkspaceSnapshot): void;
  setThreads(list: ThreadInfo[]): void;
  beginSync(threadId: string): void;
  loadHistory(threadId: string, entries: { seq: number; event: ThreadEvent }[]): void;
  setPresence(p: Presence[]): void;
  setBotHistory(channelId: string, events: BotEvent[]): void;
  startRun(run: { runId: string; name: string; args: string[] }): void;
  setDraftText(key: string, text: string): void;
  setDraftAttachments(key: string, list: DraftAttachment[]): void;
  clearDraft(key: string): void;
  selectThread(threadId: string | null): void;
  dismissPrepared(id: string): void;
  openPrepared(id: string): void;
}

export type StudioStore = StoreApi<StudioState & StudioActions>;

export function createStudioStore(): StudioStore {
  return createStore<StudioState & StudioActions>()((set) => ({
    ...initialState(),
    receive: (e) => set((s) => applyServerEvent(s, e)),
    setSnapshot: (snapshot) => set({ snapshot }),
    setThreads: (list) => set((s) => setThreads(s, list)),
    beginSync: (id) => set((s) => beginSync(s, id)),
    loadHistory: (id, entries) => set((s) => loadHistory(s, id, entries)),
    setPresence: (presence) => set({ presence }),
    setBotHistory: (c, events) => set((s) => setBotHistory(s, c, events)),
    startRun: (run) => set((s) => startRun(s, run)),
    setDraftText: (key, text) => set((s) => setDraftText(s, key, text)),
    setDraftAttachments: (key, list) => set((s) => setDraftAttachments(s, key, list)),
    clearDraft: (key) => set((s) => clearDraft(s, key)),
    selectThread: (selectedThreadId) => set({ selectedThreadId }),
    dismissPrepared: (id) => set((s) => dismissPrepared(s, id)),
    openPrepared: (id) => set((s) => openPrepared(s, id)),
  }));
}
