const USAGE_LIMIT_PATTERN = /reached your (specified )?(API )?usage limits?|usage limit(s)? (reached|exceeded)/i;

export const isUsageLimitError = (message: string | undefined | null): boolean => !!message && USAGE_LIMIT_PATTERN.test(message);
