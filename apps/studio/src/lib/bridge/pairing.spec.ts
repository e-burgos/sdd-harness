import { PAIRING_KEY, bridgeUrl, clearPairing, parsePairing, resolvePairing } from './pairing';

function fakeWindow(hash: string, stored: string | null = null) {
  const storage = new Map<string, string>(stored ? [[PAIRING_KEY, stored]] : []);
  const replaced: string[] = [];
  return {
    replaced,
    storage,
    win: {
      location: { hash, pathname: '/w/', search: '' },
      history: { replaceState: (_d: unknown, _t: string, url: string) => void replaced.push(url) },
      sessionStorage: {
        removeItem: (k: string) => void storage.delete(k),
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => void storage.set(k, v),
      },
    },
  };
}

describe('parsePairing', () => {
  it('reads port and token from the fragment', () => {
    expect(parsePairing('#bridge=4320&token=abc_DEF-123456789')).toEqual({ port: 4320, token: 'abc_DEF-123456789' });
  });
  it.each(['', '#bridge=4320', '#token=x', '#bridge=0&token=x', '#bridge=99999&token=x', '#bridge=abc&token=x', '#bridge=4320&token=short'])('rejects %j', (h) => {
    expect(parsePairing(h)).toBeNull();
  });
});

describe('resolvePairing', () => {
  it('stores the pairing in sessionStorage and strips the fragment', () => {
    const f = fakeWindow('#bridge=4320&token=tok-0123456789abcd');
    expect(resolvePairing(f.win)).toEqual({ port: 4320, token: 'tok-0123456789abcd' });
    expect(JSON.parse(f.storage.get(PAIRING_KEY)!)).toEqual({ port: 4320, token: 'tok-0123456789abcd' });
    expect(f.replaced).toEqual(['/w/']);
  });
  it('falls back to sessionStorage after a reload', () => {
    const f = fakeWindow('', JSON.stringify({ port: 4321, token: 't2-0123456789abcdef' }));
    expect(resolvePairing(f.win)).toEqual({ port: 4321, token: 't2-0123456789abcdef' });
    expect(f.replaced).toEqual([]);
  });
  it('ignores corrupt storage', () => {
    expect(resolvePairing(fakeWindow('', '{bad').win)).toBeNull();
  });
  it('builds a loopback ws url', () => {
    expect(bridgeUrl({ port: 4320, token: 'x' })).toBe('ws://127.0.0.1:4320');
  });
});

describe('pairing hardening', () => {
  it('rejects short tokens', () => {
    expect(parsePairing('#bridge=4320&token=short')).toBeNull();
  });
  it('strips the fragment even when the pairing is invalid', () => {
    const f = fakeWindow('#bridge=4320&token=short');
    expect(resolvePairing(f.win)).toBeNull();
    expect(f.replaced).toEqual(['/w/']);
    expect(f.storage.has(PAIRING_KEY)).toBe(false);
  });
  it('clearPairing removes the stored pairing and tolerates errors', () => {
    const f = fakeWindow('', JSON.stringify({ port: 1, token: 'x' }));
    clearPairing(f.win);
    expect(f.storage.has(PAIRING_KEY)).toBe(false);
    const broken = { ...f.win, sessionStorage: { ...f.win.sessionStorage, removeItem: () => { throw new Error('x'); } } };
    expect(() => clearPairing(broken)).not.toThrow();
  });
});
