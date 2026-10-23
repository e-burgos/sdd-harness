'use client';

import { useCallback, useState } from 'react';
import { z } from 'zod';

export const PANEL_STATE_KEY = 'sdd-studio.panels.v1';

const PanelState = z.object({ sidebarCollapsed: z.boolean(), rightCollapsed: z.boolean() });
export type PanelStateValue = z.infer<typeof PanelState>;

const EXPANDED: PanelStateValue = { sidebarCollapsed: false, rightCollapsed: false };

export function readPanelState(): PanelStateValue {
  try {
    const parsed = PanelState.safeParse(JSON.parse(window.localStorage.getItem(PANEL_STATE_KEY) ?? 'null'));
    return parsed.success ? parsed.data : EXPANDED;
  } catch {
    return EXPANDED;
  }
}

function writePanelState(value: PanelStateValue): void {
  try {
    window.localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(value));
  } catch {
    return;
  }
}

export function usePanelState() {
  const [state, setState] = useState<PanelStateValue>(readPanelState);
  const update = useCallback((patch: Partial<PanelStateValue>) => {
    setState((current) => {
      const next = { ...current, ...patch };
      writePanelState(next);
      return next;
    });
  }, []);
  return {
    ...state,
    setSidebarCollapsed: (collapsed: boolean) => update({ sidebarCollapsed: collapsed }),
    setRightCollapsed: (collapsed: boolean) => update({ rightCollapsed: collapsed }),
  };
}
