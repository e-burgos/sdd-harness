'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { ThreadInfo } from '@sdd-studio/protocol';
import { useBridge, useStudio } from '@/components/BridgeProvider';
import { openThread } from './bootstrap';
import { deriveConversation, listConversations, resolveSelectedThreadId, type ConversationView } from './conversation';

export interface ConversationSelection {
  conversations: ThreadInfo[];
  selectedThreadId: string | null;
  pick: (threadId: string | null) => void;
  view: ConversationView | null;
}

export function useConversationSelection(): ConversationSelection {
  const { client, store } = useBridge();
  const threads = useStudio((s) => s.threads);
  const snapshot = useStudio((s) => s.snapshot);
  const picked = useStudio((s) => s.selectedThreadId);
  const opening = useRef(new Set<string>());

  const conversations = useMemo(() => listConversations(threads), [threads]);
  const selectedThreadId = resolveSelectedThreadId(picked, threads);
  const selected = selectedThreadId ? threads[selectedThreadId] : undefined;
  const needsSync = selected !== undefined && !selected.synced;

  useEffect(() => {
    if (!selectedThreadId || !needsSync || opening.current.has(selectedThreadId)) return;
    opening.current.add(selectedThreadId);
    openThread(client, store, selectedThreadId)
      .catch(() => undefined)
      .finally(() => opening.current.delete(selectedThreadId));
  }, [client, store, selectedThreadId, needsSync]);

  const view = useMemo(() => (selected ? deriveConversation(selected, snapshot) : null), [selected, snapshot]);

  return { conversations, selectedThreadId, pick: store.getState().selectThread, view };
}
