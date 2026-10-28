import { botText } from '@/lib/format';
import type { TFunction } from '@/lib/i18n/i18n';
import type { ActivityEntry } from './activity-model';

const str = (value: unknown): string => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');

export function entryText(t: TFunction, entry: ActivityEntry): string {
  const detail = entry.detail;
  if (detail.type === 'approval') return t('activity.entry.approval', { tool: detail.tool, summary: detail.summary });
  if (detail.type === 'question') return detail.question;
  const { event } = detail;
  if (entry.kind === 'task') return t('activity.entry.task', { taskId: str(event.payload['taskId']), title: str(event.payload['title']) });
  return botText(t, event);
}

export function entryStatusText(t: TFunction, entry: ActivityEntry): string | null {
  const detail = entry.detail;
  if (detail.type === 'approval') return t(`activity.decision.${detail.decision}`);
  if (detail.type === 'question') return t(`activity.outcome.${detail.outcome}`);
  return null;
}

export function entrySearchText(t: TFunction, entry: ActivityEntry): string {
  const detail = entry.detail;
  const context = detail.type === 'bot' ? str(detail.event.channelId) : detail.threadTitle;
  return `${entryText(t, entry)} ${t(`activity.origin.${entry.kind}`)} ${t(`activity.kind.${entry.kind}`)} ${context}`;
}
