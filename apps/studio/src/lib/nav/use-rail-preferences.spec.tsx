import { act, renderHook } from '@testing-library/react';
import { MODULE_IDS } from './module-ids';
import { RAIL_KEY_PREFIX, defaultRail, moveInOrder, readRail, reconcileRail, useRailPreferences } from './use-rail-preferences';

const key = (project: string) => `${RAIL_KEY_PREFIX}${project}`;

describe('reconcileRail', () => {
  it('returns the default for anything that is not a rail preference', () => {
    expect(reconcileRail(null)).toEqual(defaultRail());
    expect(reconcileRail({ order: 'x', hidden: [] })).toEqual(defaultRail());
  });

  it('drops unknown and duplicated ids', () => {
    const { order } = reconcileRail({ order: ['kit', 'ghost', 'kit', 'home'], hidden: [] });
    expect(order.slice(0, 2)).toEqual(['kit', 'home']);
    expect(order).not.toContain('ghost');
    expect(new Set(order).size).toBe(order.length);
  });

  it('appends modules missing from the stored order, visible', () => {
    const { order, hidden } = reconcileRail({ order: ['metrics', 'home'], hidden: [] });
    expect(order).toHaveLength(MODULE_IDS.length);
    expect(order.slice(0, 2)).toEqual(['metrics', 'home']);
    expect(hidden).toEqual([]);
  });

  it('never hides Home', () => {
    expect(reconcileRail({ order: [...MODULE_IDS], hidden: ['home', 'kit', 'kit', 'ghost'] }).hidden).toEqual(['kit']);
  });
});

describe('moveInOrder', () => {
  it('swaps neighbours and ignores the edges', () => {
    expect(moveInOrder(['home', 'specs', 'fixes'] as never, 'specs', -1)).toEqual(['specs', 'home', 'fixes']);
    expect(moveInOrder(['home', 'specs'] as never, 'home', -1)).toEqual(['home', 'specs']);
    expect(moveInOrder(['home', 'specs'] as never, 'specs', 1)).toEqual(['home', 'specs']);
  });
});

describe('useRailPreferences', () => {
  beforeEach(() => window.localStorage.clear());

  it('defaults to every module in the canonical order', () => {
    const { result } = renderHook(() => useRailPreferences('p'));
    expect(result.current.visible).toEqual([...MODULE_IDS]);
    expect(result.current.hidden).toEqual([]);
    expect(result.current.isDefault).toBe(true);
  });

  it('hides, shows, moves and persists per project', () => {
    const { result, unmount } = renderHook(() => useRailPreferences('p'));
    act(() => result.current.hide('kit'));
    act(() => result.current.move('metrics', -1));
    expect(result.current.hidden).toEqual(['kit']);
    expect(result.current.visible).not.toContain('kit');
    expect(result.current.isDefault).toBe(false);
    unmount();
    expect(readRail('p').hidden).toEqual(['kit']);
    expect(readRail('other')).toEqual(defaultRail());
    const again = renderHook(() => useRailPreferences('p'));
    expect(again.result.current.hidden).toEqual(['kit']);
    act(() => again.result.current.show('kit'));
    expect(again.result.current.hidden).toEqual([]);
  });

  it('refuses to hide Home', () => {
    const { result } = renderHook(() => useRailPreferences('p'));
    act(() => result.current.hide('home'));
    expect(result.current.hidden).toEqual([]);
  });

  it('reset clears the stored preference', () => {
    const { result } = renderHook(() => useRailPreferences('p'));
    act(() => result.current.hide('fixes'));
    expect(window.localStorage.getItem(key('p'))).not.toBeNull();
    act(() => result.current.reset());
    expect(window.localStorage.getItem(key('p'))).toBeNull();
    expect(result.current.isDefault).toBe(true);
  });

  it('uses the default when storage throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useRailPreferences('p'));
    expect(result.current.visible).toEqual([...MODULE_IDS]);
    expect(() => act(() => result.current.hide('kit'))).not.toThrow();
    expect(result.current.hidden).toEqual(['kit']);
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it('reads a stale preference without error', () => {
    window.localStorage.setItem(key('p'), JSON.stringify({ order: ['ghost', 'specs'], hidden: ['ghost', 'home'] }));
    const { result } = renderHook(() => useRailPreferences('p'));
    expect(result.current.visible[0]).toBe('specs');
    expect(result.current.visible).toContain('home');
    expect(result.current.visible).toHaveLength(MODULE_IDS.length);
  });
});
