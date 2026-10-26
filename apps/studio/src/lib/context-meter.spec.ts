import { contextMeterOf } from './context-meter';

describe('contextMeterOf', () => {
  it('has no reading without usage or with an unusable window', () => {
    expect(contextMeterOf(null).level).toBe('none');
    expect(contextMeterOf(undefined).level).toBe('none');
    expect(contextMeterOf({ usedTokens: 10, maxTokens: 0 }).level).toBe('none');
  });
  it.each([
    [0, 'ok'], [69_000, 'ok'], [70_000, 'warn'], [89_000, 'warn'], [90_000, 'critical'], [100_000, 'critical'],
  ] as const)('classifies %i of 100000 tokens as %s', (usedTokens, level) => {
    expect(contextMeterOf({ usedTokens, maxTokens: 100_000 }).level).toBe(level);
  });
  it('rounds the percentage and never goes past 100', () => {
    expect(contextMeterOf({ usedTokens: 1, maxTokens: 3 }).percent).toBe(33);
    expect(contextMeterOf({ usedTokens: 300, maxTokens: 100 }).percent).toBe(100);
  });
});
