import { describe, expect, it } from 'vitest';
import { createToken, originAllowed, tokensMatch } from './security';

const ALLOWED = ['https://studio.sdd.estebanburgos.com.ar', 'http://localhost:*', 'http://127.0.0.1:*'];

describe('security', () => {
  it('creates 43-char base64url tokens', () => {
    const t = createToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createToken()).not.toBe(t);
  });
  it('compares tokens of any length safely', () => {
    expect(tokensMatch('abc', 'abc')).toBe(true);
    expect(tokensMatch('abc', 'abd')).toBe(false);
    expect(tokensMatch('abc', 'abcd')).toBe(false);
  });
  it.each([
    ['https://studio.sdd.estebanburgos.com.ar', true],
    ['http://localhost:3000', true],
    ['http://localhost', true],
    ['http://127.0.0.1:4320', true],
    ['https://evil.example', false],
    ['http://localhost.evil.example:80', false],
    ['https://studio.sdd.estebanburgos.com.ar.evil.example', false],
    ['null', false],
    [undefined, true],
  ])('origin %s → %s', (origin, expected) => {
    expect(originAllowed(origin, ALLOWED)).toBe(expected);
  });
});
