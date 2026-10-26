import { isUsageLimitError } from './usage-limit';

describe('isUsageLimitError', () => {
  it('detects the engine usage-limit error', () => {
    expect(isUsageLimitError('API Error: 400 You have reached your specified API usage limits.')).toBe(true);
  });
  it('ignores other errors and empty values', () => {
    expect(isUsageLimitError('API Error: 500 overloaded')).toBe(false);
    expect(isUsageLimitError(undefined)).toBe(false);
  });
});
