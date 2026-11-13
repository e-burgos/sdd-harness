import type { BotEvent } from '@sdd-studio/protocol';
import type { TFunction } from './i18n/i18n';
import { toolChangeVars } from './tools-text';

export const formatCost = (usd: number): string => (usd < 1 ? `$${usd.toFixed(3)}` : `$${usd.toFixed(2)}`);

export const formatTokens = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function botText(t: TFunction, e: BotEvent): string {
  if (e.botKind === 'tools.changed') return t('bot.tools.changed', toolChangeVars(t, e.payload));
  if (e.botKind === 'integration.changed') {
    const integration = typeof e.payload['integration'] === 'string' ? e.payload['integration'] : '';
    const state = typeof e.payload['state'] === 'string' ? e.payload['state'] : 'unavailable';
    return t('bot.integration.changed', { integration, state: t(`module.kit.integrations.state.${state}` as Parameters<TFunction>[0]) });
  }
  const vars = Object.fromEntries(
    Object.entries(e.payload).map(([k, v]) => [k, typeof v === 'string' || typeof v === 'number' ? v : String(v ?? '')]),
  );
  return t(`bot.${e.botKind}` as Parameters<TFunction>[0], vars);
}

export const formatBytes = (bytes: number): string =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;
