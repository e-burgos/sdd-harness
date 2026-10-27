'use client';

import type { Presence, ThreadInfo } from '@sdd-studio/protocol';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ConversationDialogue, ConversationView } from '@/lib/conversation';
import { useConversationSelection } from '@/lib/use-conversation-selection';
import { useStudio } from '../../BridgeProvider';

const PLAYBACK_INTERVAL_MS = 5000;

export interface SwarmPlayback {
  conversations: ThreadInfo[];
  selectedThreadId: string | null;
  pick: (threadId: string | null) => void;
  view: ConversationView | null;
  dialogues: ConversationDialogue[];
  currentDialogue: ConversationDialogue | null;
  inspectedDialogueId: string | null;
  isPlaying: boolean;
  togglePlay: () => void;
  next: () => void;
  inspect: (dialogue: ConversationDialogue) => void;
  conversationPresence: Presence[];
}

const SwarmPlaybackContext = createContext<SwarmPlayback | null>(null);

export function SwarmPlaybackProvider({ children }: { children: ReactNode }) {
  const { conversations, selectedThreadId, pick, view } = useConversationSelection();
  const presence = useStudio((s) => s.presence);
  const dialogues = useMemo(() => view?.dialogues ?? [], [view]);
  const lastIdx = dialogues.length - 1;
  const [dialogueIdx, setDialogueIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [inspectedDialogueId, setInspectedDialogueId] = useState<string | null>(null);

  useEffect(() => {
    setDialogueIdx(Math.max(0, lastIdx));
    setInspectedDialogueId(null);
  }, [selectedThreadId, lastIdx]);

  useEffect(() => {
    if (!isPlaying || dialogues.length === 0) return;
    const timer = setInterval(() => {
      setDialogueIdx((prev) => {
        if (prev + 1 >= dialogues.length) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, PLAYBACK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isPlaying, dialogues.length]);

  const togglePlay = useCallback(() => setIsPlaying((playing) => !playing), []);
  const next = useCallback(() => setDialogueIdx((prev) => (dialogues.length === 0 ? 0 : (prev + 1) % dialogues.length)), [dialogues.length]);
  const inspect = useCallback(
    (dialogue: ConversationDialogue) => {
      setInspectedDialogueId(dialogue.id);
      const idx = dialogues.findIndex((item) => item.id === dialogue.id);
      if (idx >= 0) setDialogueIdx(idx);
    },
    [dialogues],
  );
  const conversationPresence = useMemo(() => presence.filter((p) => p.threadId !== null && p.threadId === selectedThreadId), [presence, selectedThreadId]);
  const currentDialogue = dialogues[Math.min(dialogueIdx, lastIdx)] ?? null;

  const value = useMemo<SwarmPlayback>(
    () => ({ conversations, selectedThreadId, pick, view, dialogues, currentDialogue, inspectedDialogueId, isPlaying, togglePlay, next, inspect, conversationPresence }),
    [conversations, selectedThreadId, pick, view, dialogues, currentDialogue, inspectedDialogueId, isPlaying, togglePlay, next, inspect, conversationPresence],
  );
  return <SwarmPlaybackContext.Provider value={value}>{children}</SwarmPlaybackContext.Provider>;
}

export function useSwarmPlayback(): SwarmPlayback {
  const value = useContext(SwarmPlaybackContext);
  if (!value) throw new Error('useSwarmPlayback must be used within SwarmPlaybackProvider');
  return value;
}

export function SwarmScopeGuard({ children }: { children: ReactNode }) {
  return useContext(SwarmPlaybackContext) ? <>{children}</> : <SwarmPlaybackProvider>{children}</SwarmPlaybackProvider>;
}
