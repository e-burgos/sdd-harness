import type { BatchSummary, TaskSummary, TaskUsageSummary } from '@sdd-studio/protocol';
import type { Lang, TFunction } from './i18n/i18n';

export const VERIFY_TAIL_LINES = 40;

export const KIT_EXECUTION = 'kit-execution' as const;

export function compactTokens(tokens: number, lang: Lang): string {
  if (tokens < 1000) return String(Math.round(tokens));
  const text = `${(tokens / 1000).toFixed(1)}k`;
  return lang === 'es' ? text.replace('.', ',') : text;
}

export function usageChipText(usage: TaskUsageSummary, lang: Lang): string {
  const parts = [`${usage.approx ? '≈' : ''}${compactTokens(usage.tokensTotal, lang)}`];
  if (usage.providerModel) parts.push(usage.providerModel);
  if (usage.agent) parts.push(usage.agent);
  return parts.join(' · ');
}

export interface TaskBlock {
  batch: BatchSummary | null;
  tasks: TaskSummary[];
}

export function groupTasksByBatch(tasks: readonly TaskSummary[], batches: readonly BatchSummary[]): TaskBlock[] {
  const claimed = new Set<string>();
  const blocks = batches.map((batch) => {
    const ids = new Set(batch.tasks);
    const own = tasks.filter((task) => task.batch === batch.id || ids.has(task.id));
    own.forEach((task) => claimed.add(task.id));
    return { batch, tasks: own };
  });
  const loose = tasks.filter((task) => !claimed.has(task.id));
  return loose.length > 0 ? [...blocks, { batch: null, tasks: loose }] : blocks;
}

export const blockTokens = (tasks: readonly TaskSummary[]): number => tasks.reduce((sum, task) => sum + (task.usage?.tokensTotal ?? 0), 0);

export const blockHasApprox = (tasks: readonly TaskSummary[]): boolean => tasks.some((task) => task.usage?.approx);

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export function agoText(iso: string, now: number, t: TFunction): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return '';
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return t('kitexec.ago.seconds', { n: seconds });
  if (seconds < 3600) return t('kitexec.ago.minutes', { n: Math.floor(seconds / 60) });
  if (seconds < 86_400) return t('kitexec.ago.hours', { n: Math.floor(seconds / 3600) });
  return t('kitexec.ago.days', { n: Math.floor(seconds / 86_400) });
}

export const shortRepo = (repo: string): string => repo.split(/[\\/]/).filter(Boolean).pop() ?? repo;

export const shortCommit = (commit: string | null): string => (commit ? commit.slice(0, 7) : '—');

export const tailLines = (output: string, count: number = VERIFY_TAIL_LINES): string => output.split('\n').slice(-count).join('\n');

export type VerifyExit = 'ok' | 'failed' | 'lease' | 'error';

export const verifyExitKind = (code: number): VerifyExit => (code === 0 ? 'ok' : code === 1 ? 'failed' : code === 75 ? 'lease' : 'error');
