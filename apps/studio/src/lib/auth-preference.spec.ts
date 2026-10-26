import { loadAuthPreference, saveAuthPreference } from './auth-preference';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe('auth preference storage', () => {
  it('round-trips a valid preference and ignores junk', () => {
    const store = memory();
    expect(loadAuthPreference(store)).toBeNull();
    saveAuthPreference('subscription', store);
    expect(loadAuthPreference(store)).toBe('subscription');
    store.setItem('sdd-studio.authPreference', 'other');
    expect(loadAuthPreference(store)).toBeNull();
  });
  it('survives a storage that throws', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadAuthPreference(broken)).toBeNull();
    expect(() => saveAuthPreference('api-key', broken)).not.toThrow();
  });
});
