'use client';

import { useMemo } from 'react';
import { useStudio } from '@/components/BridgeProvider';
import { deriveConversation, resolveSelectedThreadId, type ConversationView } from './conversation';

export function useSelectedConversation(): { selectedThreadId: string | null; view: ConversationView | null } {
  const threads = useStudio((s) => s.threads);
  const snapshot = useStudio((s) => s.snapshot);
  const picked = useStudio((s) => s.selectedThreadId);
  const selectedThreadId = resolveSelectedThreadId(picked, threads);
  const selected = selectedThreadId ? threads[selectedThreadId] : undefined;
  const view = useMemo(() => (selected ? deriveConversation(selected, snapshot) : null), [selected, snapshot]);
  return { selectedThreadId, view };
}
