import { describe, expect, it } from 'vitest';
import { clearApiKey, isPlausibleApiKey, loadApiKey, saveApiKey } from './api-key';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

describe('api-key storage', () => {
  it('defaults to the tab (sessionStorage) and not localStorage', () => {
    const s = mem(), l = mem();
    saveApiKey('k'.repeat(30), false, s, l);
    expect(l.getItem('sdd-studio.apiKey')).toBeNull();
    expect(loadApiKey(s, l)).toEqual({ apiKey: 'k'.repeat(30), remembered: false });
  });
  it('uses localStorage only when remembered, and never both', () => {
    const s = mem(), l = mem();
    saveApiKey('a'.repeat(30), false, s, l);
    saveApiKey('b'.repeat(30), true, s, l);
    expect(s.getItem('sdd-studio.apiKey')).toBeNull();
    expect(loadApiKey(s, l)).toEqual({ apiKey: 'b'.repeat(30), remembered: true });
  });
  it('clears both and survives a throwing storage', () => {
    const s = mem(), l = mem();
    saveApiKey('k'.repeat(30), true, s, l);
    clearApiKey(s, l);
    expect(loadApiKey(s, l)).toBeNull();
    const boom = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(loadApiKey(boom, boom)).toBeNull();
    expect(() => saveApiKey('k'.repeat(30), false, boom, boom)).not.toThrow();
  });
  it('validates plausible keys', () => {
    expect(isPlausibleApiKey('sk-ant-' + 'x'.repeat(30))).toBe(true);
    expect(isPlausibleApiKey('short')).toBe(false);
    expect(isPlausibleApiKey('has space in it ' + 'x'.repeat(30))).toBe(false);
  });
});
