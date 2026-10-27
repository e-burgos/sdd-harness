'use client';

import { useCallback } from 'react';
import { useNav } from './use-nav';
import type { ModuleId } from './module-ids';

export function useModuleQuery(module: ModuleId): [string, (next: string) => void] {
  const query = useNav((s) => s.queries[module] ?? '');
  const setQuery = useNav((s) => s.setQuery);
  const update = useCallback((next: string) => setQuery(module, next), [module, setQuery]);
  return [query, update];
}
