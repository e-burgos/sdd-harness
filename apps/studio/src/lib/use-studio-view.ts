'use client';

import { useState } from 'react';

export type StudioView = 'workspace' | 'agent-map' | 'ecosystem' | 'telemetry';

export const STUDIO_VIEW_KEY = 'sdd-studio.active-view';

export function useStudioView(initial: StudioView = 'workspace') {
  const [activeView, setActiveView] = useState<StudioView>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const stored = window.localStorage.getItem(STUDIO_VIEW_KEY);
      if (stored === 'workspace' || stored === 'agent-map' || stored === 'ecosystem' || stored === 'telemetry') {
        return stored;
      }
    } catch {}
    return initial;
  });

  const changeView = (next: StudioView) => {
    setActiveView(next);
    try {
      window.localStorage.setItem(STUDIO_VIEW_KEY, next);
    } catch {}
  };

  return { activeView, setActiveView: changeView };
}
