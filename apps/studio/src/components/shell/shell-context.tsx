'use client';

import { createContext, useContext } from 'react';
import type { CollapsedState } from '@/lib/use-collapsed-state';
import type { ModuleId } from '@/lib/nav/module-ids';

export interface ShellActions {
  collapsePanel(): void;
  collapseRight(): void;
}

export const ShellActionsContext = createContext<ShellActions>({ collapsePanel: () => undefined, collapseRight: () => undefined });
export const useShellActions = () => useContext(ShellActionsContext);

export interface PanelScope {
  moduleId: ModuleId;
  collapse: CollapsedState;
  searching: boolean;
}

export const PanelScopeContext = createContext<PanelScope | null>(null);

export function usePanelScope(): PanelScope {
  const scope = useContext(PanelScopeContext);
  if (!scope) throw new Error('PanelGroup must be rendered inside ModulePanel');
  return scope;
}

export const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';
