import { PAIRING_KEY, bridgeUrl, parsePairing, resolvePairing } from './pairing';

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
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => void storage.set(k, v),
      },
    },
  };
}

describe('parsePairing', () => {
  it('reads port and token from the fragment', () => {
    expect(parsePairing('#bridge=4320&token=abc_DEF-123')).toEqual({ port: 4320, token: 'abc_DEF-123' });
  });
  it.each(['', '#bridge=4320', '#token=x', '#bridge=0&token=x', '#bridge=99999&token=x', '#bridge=abc&token=x'])('rejects %j', (h) => {
    expect(parsePairing(h)).toBeNull();
  });
});

describe('resolvePairing', () => {
  it('stores the pairing in sessionStorage and strips the fragment', () => {
    const f = fakeWindow('#bridge=4320&token=tok');
    expect(resolvePairing(f.win)).toEqual({ port: 4320, token: 'tok' });
    expect(JSON.parse(f.storage.get(PAIRING_KEY)!)).toEqual({ port: 4320, token: 'tok' });
    expect(f.replaced).toEqual(['/w/']);
  });
  it('falls back to sessionStorage after a reload', () => {
    const f = fakeWindow('', JSON.stringify({ port: 4321, token: 't2' }));
    expect(resolvePairing(f.win)).toEqual({ port: 4321, token: 't2' });
    expect(f.replaced).toEqual([]);
  });
  it('ignores corrupt storage', () => {
    expect(resolvePairing(fakeWindow('', '{bad').win)).toBeNull();
  });
  it('builds a loopback ws url', () => {
    expect(bridgeUrl({ port: 4320, token: 'x' })).toBe('ws://127.0.0.1:4320');
  });
});
