'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useNav } from '@/lib/nav/use-nav';
import { toggleKind, type ActivityKind } from './activity-model';
import { useActivityFeedLoader, type ActivityFeed } from './use-activity-feed';

export interface ActivityFilter {
  selected: ActivityKind[];
  toggle(kind: ActivityKind): void;
  clear(): void;
}

interface ActivityScopeValue {
  filter: ActivityFilter;
  feed: ActivityFeed;
}

const ActivityScopeContext = createContext<ActivityScopeValue | null>(null);

function useFilterState(): ActivityFilter {
  const selected = useNav((s) => s.filters.activity);
  const setFilter = useNav((s) => s.setFilter);
  const toggle = useCallback((kind: ActivityKind) => setFilter('activity', toggleKind(selected, kind)), [setFilter, selected]);
  const clear = useCallback(() => setFilter('activity', []), [setFilter]);
  return useMemo(() => ({ selected, toggle, clear }), [selected, toggle, clear]);
}

export function ActivityScope({ children }: { children: ReactNode }) {
  const filter = useFilterState();
  const feed = useActivityFeedLoader(true);
  const value = useMemo(() => ({ filter, feed }), [filter, feed]);
  return <ActivityScopeContext.Provider value={value}>{children}</ActivityScopeContext.Provider>;
}

export function useActivityFilter(): ActivityFilter {
  const local = useFilterState();
  return useContext(ActivityScopeContext)?.filter ?? local;
}

export function useActivityFeed(): ActivityFeed {
  const scope = useContext(ActivityScopeContext);
  const local = useActivityFeedLoader(scope === null);
  return scope?.feed ?? local;
}
