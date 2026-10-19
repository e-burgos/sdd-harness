import type { BotEvent } from '@sdd-studio/protocol';
import type { TFunction } from './i18n/i18n';

export const formatCost = (usd: number): string => (usd < 1 ? `$${usd.toFixed(3)}` : `$${usd.toFixed(2)}`);

export const formatTokens = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function botText(t: TFunction, e: BotEvent): string {
  const vars = Object.fromEntries(
    Object.entries(e.payload).map(([k, v]) => [k, typeof v === 'string' || typeof v === 'number' ? v : String(v ?? '')]),
  );
  return t(`bot.${e.botKind}` as Parameters<TFunction>[0], vars);
}
