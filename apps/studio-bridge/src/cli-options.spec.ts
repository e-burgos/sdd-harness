import { describe, expect, it } from 'vitest';
import { parseEngine, parsePort, parseToken, parseWebUrl } from './cli-options';
import { BridgeStartError } from './main';

describe('cli option validators', () => {
  it('parsePort accepts 0-65535 integers only', () => {
    expect(parsePort('0')).toBe(0);
    expect(parsePort('4320')).toBe(4320);
    expect(parsePort('65535')).toBe(65535);
    for (const bad of ['abc', '', '65536', '-1', '1.5', '12ab']) {
      expect(() => parsePort(bad)).toThrow(BridgeStartError);
    }
    expect(() => parsePort('abc')).toThrow(/Puerto inválido: abc/);
  });
  it('parseEngine rejects unknown engines', () => {
    expect(parseEngine('fake')).toBe('fake');
    expect(parseEngine('claude')).toBe('claude');
    expect(() => parseEngine('claud')).toThrow(BridgeStartError);
  });
  it('parseWebUrl requires http(s) without query or hash', () => {
    expect(parseWebUrl('https://a.test/')).toBe('https://a.test/');
    for (const bad of ['ftp://a.test', 'nope', 'https://a.test/?x=1', 'https://a.test/#h']) {
      expect(() => parseWebUrl(bad)).toThrow(BridgeStartError);
    }
  });
});

describe('parseToken', () => {
  it('accepts 16+ url-safe chars', () => {
    expect(parseToken('e2e-token-0123456789abcdef')).toBe('e2e-token-0123456789abcdef');
  });
  it.each(['short', 'has space in it 1234', 'ñññññññññññññññññ', ''])('rejects %j', (raw) => {
    expect(() => parseToken(raw)).toThrow(BridgeStartError);
  });
});
