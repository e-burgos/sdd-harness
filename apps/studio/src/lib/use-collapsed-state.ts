'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';

export const COLLAPSED_KEY_PREFIX = 'sdd-studio.sidebar.v1:';
export const MAX_COLLAPSE_OVERRIDES = 500;

const Overrides = z.record(z.string().max(256), z.boolean());
export type CollapseOverrides = z.infer<typeof Overrides>;

export function parseCollapseOverrides(raw: string | null): CollapseOverrides {
  if (raw === null) return {};
  try {
    const parsed = Overrides.safeParse(JSON.parse(raw));
    return parsed.success ? pruneCollapseOverrides(parsed.data) : {};
  } catch {
    return {};
  }
}

export function pruneCollapseOverrides(overrides: CollapseOverrides): CollapseOverrides {
  const entries = Object.entries(overrides);
  return entries.length <= MAX_COLLAPSE_OVERRIDES ? overrides : Object.fromEntries(entries.slice(-MAX_COLLAPSE_OVERRIDES));
}

const read = (key: string): CollapseOverrides => {
  try {
    return parseCollapseOverrides(window.localStorage.getItem(key));
  } catch {
    return {};
  }
};

const write = (key: string, overrides: CollapseOverrides) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(overrides));
  } catch {
    return;
  }
};

export interface CollapsedState {
  isCollapsed(nodeId: string, defaultCollapsed: boolean): boolean;
  setCollapsed(nodeId: string, collapsed: boolean, defaultCollapsed: boolean): void;
  toggle(nodeId: string, defaultCollapsed: boolean): void;
}

export function useCollapsedState(project: string): CollapsedState {
  const key = `${COLLAPSED_KEY_PREFIX}${project}`;
  const [overrides, setOverrides] = useState<CollapseOverrides>({});

  useEffect(() => {
    setOverrides(read(key));
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) setOverrides(read(key));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  const isCollapsed = useCallback((nodeId: string, defaultCollapsed: boolean) => overrides[nodeId] ?? defaultCollapsed, [overrides]);

  const setCollapsed = useCallback(
    (nodeId: string, collapsed: boolean, defaultCollapsed: boolean) => {
      const { [nodeId]: _previous, ...rest } = read(key);
      const next = pruneCollapseOverrides(collapsed === defaultCollapsed ? rest : { ...rest, [nodeId]: collapsed });
      write(key, next);
      setOverrides(next);
    },
    [key],
  );

  const toggle = useCallback(
    (nodeId: string, defaultCollapsed: boolean) => setCollapsed(nodeId, !(overrides[nodeId] ?? defaultCollapsed), defaultCollapsed),
    [overrides, setCollapsed],
  );

  return { isCollapsed, setCollapsed, toggle };
}
