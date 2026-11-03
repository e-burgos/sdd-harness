'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { isHideable, isModuleId, MODULE_IDS, type ModuleId } from './module-ids';

export const RAIL_KEY_PREFIX = 'sdd-studio.rail.v1:';

export interface RailPreference {
  order: ModuleId[];
  hidden: ModuleId[];
}

const RawRail = z.object({ order: z.array(z.unknown()), hidden: z.array(z.unknown()) });

const unique = <T>(list: T[]): T[] => [...new Set(list)];

export const defaultRail = (): RailPreference => ({ order: [...MODULE_IDS], hidden: [] });

export function reconcileRail(raw: unknown): RailPreference {
  const parsed = RawRail.safeParse(raw);
  if (!parsed.success) return defaultRail();
  const known = unique(parsed.data.order.filter(isModuleId));
  const order = [...known, ...MODULE_IDS.filter((id) => !known.includes(id))];
  const hidden = unique(parsed.data.hidden.filter(isModuleId)).filter(isHideable);
  return { order, hidden };
}

const storageKey = (project: string) => `${RAIL_KEY_PREFIX}${project}`;

export function readRail(project: string): RailPreference {
  try {
    const raw = window.localStorage.getItem(storageKey(project));
    return raw === null ? defaultRail() : reconcileRail(JSON.parse(raw));
  } catch {
    return defaultRail();
  }
}

function writeRail(project: string, value: RailPreference): void {
  try {
    window.localStorage.setItem(storageKey(project), JSON.stringify(value));
  } catch {
    return;
  }
}

function clearRail(project: string): void {
  try {
    window.localStorage.removeItem(storageKey(project));
  } catch {
    return;
  }
}

export function moveInOrder(order: ModuleId[], id: ModuleId, delta: -1 | 1): ModuleId[] {
  const from = order.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= order.length) return order;
  const next = [...order];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

export function useRailPreferences(project: string) {
  const [preference, setPreference] = useState<RailPreference>(defaultRail);

  useEffect(() => {
    setPreference(readRail(project));
  }, [project]);

  const commit = useCallback(
    (next: RailPreference) => {
      setPreference(next);
      writeRail(project, next);
    },
    [project],
  );

  const hide = useCallback(
    (id: ModuleId) => {
      if (!isHideable(id)) return;
      commit({ ...preference, hidden: unique([...preference.hidden, id]) });
    },
    [commit, preference],
  );
  const show = useCallback((id: ModuleId) => commit({ ...preference, hidden: preference.hidden.filter((h) => h !== id) }), [commit, preference]);
  const move = useCallback((id: ModuleId, delta: -1 | 1) => commit({ ...preference, order: moveInOrder(preference.order, id, delta) }), [commit, preference]);
  const reset = useCallback(() => {
    clearRail(project);
    setPreference(defaultRail());
  }, [project]);

  const visible = useMemo(() => preference.order.filter((id) => !preference.hidden.includes(id)), [preference]);
  const hiddenInOrder = useMemo(() => preference.order.filter((id) => preference.hidden.includes(id)), [preference]);
  const isDefault = useMemo(
    () => preference.hidden.length === 0 && preference.order.every((id, index) => id === MODULE_IDS[index]),
    [preference],
  );

  return { order: preference.order, visible, hidden: hiddenInOrder, isDefault, hide, show, move, reset };
}
