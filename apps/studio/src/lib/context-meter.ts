import type { ContextUsage } from '@sdd-studio/protocol';

export const CONTEXT_WARN_PERCENT = 70;
export const CONTEXT_CRITICAL_PERCENT = 90;

export type ContextLevel = 'none' | 'ok' | 'warn' | 'critical';

export interface ContextMeterReading {
  level: ContextLevel;
  percent: number;
  usedTokens: number;
  maxTokens: number;
}

const NO_READING: ContextMeterReading = { level: 'none', percent: 0, usedTokens: 0, maxTokens: 0 };

export function contextMeterOf(usage: ContextUsage | null | undefined): ContextMeterReading {
  if (!usage || usage.maxTokens <= 0) return NO_READING;
  const percent = Math.min(100, Math.round((usage.usedTokens / usage.maxTokens) * 100));
  const level: ContextLevel = percent >= CONTEXT_CRITICAL_PERCENT ? 'critical' : percent >= CONTEXT_WARN_PERCENT ? 'warn' : 'ok';
  return { level, percent, usedTokens: usage.usedTokens, maxTokens: usage.maxTokens };
}
