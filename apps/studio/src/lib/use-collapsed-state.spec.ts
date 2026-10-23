import { act, renderHook } from '@testing-library/react';
import { COLLAPSED_KEY_PREFIX, MAX_COLLAPSE_OVERRIDES, parseCollapseOverrides, useCollapsedState } from './use-collapsed-state';

const KEY = `${COLLAPSED_KEY_PREFIX}proj`;

beforeEach(() => window.localStorage.clear());

describe('parseCollapseOverrides', () => {
  it.each([[null], ['not json'], ['[1]'], ['{"a":"yes"}'], ['"x"']])('falls back to defaults for %s', (raw) => {
    expect(parseCollapseOverrides(raw)).toEqual({});
  });
  it('keeps a valid map and prunes it to the most recent 500 entries', () => {
    const big = Object.fromEntries(Array.from({ length: 520 }, (_, i) => [`n${i}`, true]));
    const parsed = parseCollapseOverrides(JSON.stringify(big));
    expect(Object.keys(parsed)).toHaveLength(MAX_COLLAPSE_OVERRIDES);
    expect(parsed['n519']).toBe(true);
    expect(parsed['n0']).toBeUndefined();
  });
});

describe('useCollapsedState', () => {
  it('uses the default until toggled and stores only overrides', () => {
    const { result } = renderHook(() => useCollapsedState('proj'));
    expect(result.current.isCollapsed('spec:s1', false)).toBe(false);
    act(() => result.current.toggle('spec:s1', false));
    expect(result.current.isCollapsed('spec:s1', false)).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({ 'spec:s1': true });
    act(() => result.current.toggle('spec:s1', false));
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({});
  });

  it('restores overrides after a reload', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ 'fix:FIX-1': false }));
    const { result } = renderHook(() => useCollapsedState('proj'));
    expect(result.current.isCollapsed('fix:FIX-1', true)).toBe(false);
  });

  it('ignores invalid persisted state without throwing', () => {
    window.localStorage.setItem(KEY, '{"a": 5}');
    const { result } = renderHook(() => useCollapsedState('proj'));
    expect(result.current.isCollapsed('a', true)).toBe(true);
  });

  it('keeps projects isolated', () => {
    window.localStorage.setItem(`${COLLAPSED_KEY_PREFIX}other`, JSON.stringify({ x: true }));
    const { result } = renderHook(() => useCollapsedState('proj'));
    expect(result.current.isCollapsed('x', false)).toBe(false);
  });

  it('syncs when another tab writes the same key', () => {
    const { result } = renderHook(() => useCollapsedState('proj'));
    window.localStorage.setItem(KEY, JSON.stringify({ 'section:specs': true }));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });
    expect(result.current.isCollapsed('section:specs', false)).toBe(true);
  });

  it('prunes to 500 overrides when writing', () => {
    const { result } = renderHook(() => useCollapsedState('proj'));
    for (let i = 0; i < MAX_COLLAPSE_OVERRIDES + 3; i++) act(() => result.current.setCollapsed(`n${i}`, true, false));
    const stored = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(Object.keys(stored)).toHaveLength(MAX_COLLAPSE_OVERRIDES);
    expect(stored['n0']).toBeUndefined();
  });
});
