'use client';

import { Bot, CircleCheck, CircleHelp, MessageSquare, ShieldQuestion, Wrench, FileText, type LucideIcon } from 'lucide-react';
import { useT, type Lang, type TFunction } from '@/lib/i18n/i18n';
import { PANEL_TYPE, ROW_ICON } from '@/lib/typography-tokens';
import { focusRing } from '../../shell/shell-context';
import { dayKeyOf, UNDATED_DAY, type ActivityDay, type ActivityEntry, type ActivityKind } from './activity-model';
import { entryStatusText, entryText } from './activity-text';

const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  approval: ShieldQuestion,
  question: CircleHelp,
  task: CircleCheck,
  spec: FileText,
  fix: Wrench,
  tools: Bot,
  conversation: MessageSquare,
};

export function dayLabel(t: TFunction, lang: Lang, day: ActivityDay, now: number = Date.now()): string {
  if (day.key === UNDATED_DAY || day.at === null) return t('activity.day.undated');
  if (day.key === dayKeyOf(new Date(now).toISOString())) return t('activity.day.today');
  if (day.key === dayKeyOf(new Date(now - 86_400_000).toISOString())) return t('activity.day.yesterday');
  return new Date(day.at).toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
}

function timeLabel(lang: Lang, entry: ActivityEntry): string | null {
  if (entry.at === null) return null;
  const time = Date.parse(entry.at);
  return Number.isFinite(time) ? new Date(time).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) : null;
}

const ROW = 'flex w-full items-start gap-3 rounded-lg border border-foreground/10 bg-ink-900 px-3 py-2 text-left';

function EntryRow({ entry, onOpen }: { entry: ActivityEntry; onOpen(entry: ActivityEntry): void }) {
  const { t, lang } = useT();
  const Icon = KIND_ICON[entry.kind];
  const status = entryStatusText(t, entry);
  const time = timeLabel(lang, entry);
  const body = (
    <>
      <Icon aria-hidden size={ROW_ICON} className="mt-0.5 shrink-0 text-ink-400" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`${PANEL_TYPE.item} break-words text-ink-100`}>{entryText(t, entry)}</span>
        <span className={`${PANEL_TYPE.meta} text-ink-400`}>{[t(`activity.origin.${entry.kind}`), status].filter(Boolean).join(' · ')}</span>
      </span>
      {time && (
        <span className={`${PANEL_TYPE.meta} shrink-0 text-ink-400`} title={entry.approx ? t('activity.approx') : undefined}>
          {entry.approx ? `~${time}` : time}
        </span>
      )}
    </>
  );
  if (entry.target === null) return <div className={ROW}>{body}</div>;
  return (
    <button type="button" className={`${ROW} ${focusRing} transition-colors hover:border-ink-700`} onClick={() => onOpen(entry)}>
      {body}
    </button>
  );
}

export function ActivityTimeline({ days, onOpen }: { days: ActivityDay[]; onOpen(entry: ActivityEntry): void }) {
  const { t, lang } = useT();
  return (
    <div className="space-y-6">
      {days.map((day) => {
        const label = dayLabel(t, lang, day);
        return (
          <section key={day.key} aria-label={label}>
            <h2 className={`${PANEL_TYPE.group} mb-2 capitalize`}>{label}</h2>
            <ul className="space-y-1.5">
              {day.entries.map((entry) => (
                <li key={entry.id}>
                  <EntryRow entry={entry} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
