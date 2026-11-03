import { create } from 'zustand';

interface MapChatState {
  open: boolean;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  openChat: () => void;
  closeChat: () => void;
}

export const useMapChatState = create<MapChatState>((set) => ({
  open: false,
  expanded: false,
  setExpanded: (expanded) => set({ expanded }),
  openChat: () => set({ open: true, expanded: true }),
  closeChat: () => set({ open: false, expanded: false }),
}));
