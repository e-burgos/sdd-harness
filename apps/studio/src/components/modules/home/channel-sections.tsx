'use client';

import { Bot } from 'lucide-react';
import type { BotEvent, ThreadInfo } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { botText } from '@/lib/format';
import { useT, type Lang } from '@/lib/i18n/i18n';
import { PANEL_TYPE } from '@/lib/typography-tokens';
import { AgentAvatar } from '../../workspace/AgentAvatar';
import { StatusBadge } from '../../workspace/StatusBadge';

export function formatWhen(iso: string | undefined, lang: Lang): string {
  if (!iso) return '';
  const time = Date.parse(iso);
  return Number.isFinite(time) ? new Date(time).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' }) : '';
}

export function SectionTitle({ children }: { children: string }) {
  return <h2 className={`${PANEL_TYPE.group} mb-2`}>{children}</h2>;
}

export function ThreadRows({ threads, onOpen, emptyText }: { threads: ThreadInfo[]; onOpen(id: string): void; emptyText: string }) {
  if (threads.length === 0) return <p className={`${PANEL_TYPE.item} text-ink-300`}>{emptyText}</p>;
  return (
    <ul className="space-y-1.5">
      {threads.map((thread) => (
        <li key={thread.id}>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg border border-foreground/10 bg-ink-900 px-3 py-2 text-left hover:border-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            onClick={() => onOpen(thread.id)}
          >
            <AgentAvatar agent={thread.agent} size={24} status={thread.status} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={`${PANEL_TYPE.item} truncate`}>{thread.title}</span>
              <span className={`${PANEL_TYPE.meta} truncate text-ink-400`}>{agentMeta(thread.agent).name}</span>
            </span>
            <StatusBadge status={thread.status} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function EventRows({ events, emptyText, withChannel = false }: { events: BotEvent[]; emptyText: string; withChannel?: boolean }) {
  const { t, lang } = useT();
  if (events.length === 0) return <p className={`${PANEL_TYPE.item} text-ink-300`}>{emptyText}</p>;
  return (
    <ul className="space-y-1">
      {events.map((event, index) => (
        <li key={`${event.channelId}:${event.botKind}:${event.at ?? ''}:${index}`} className="flex items-baseline gap-2">
          <Bot aria-hidden size={16} className="shrink-0 translate-y-0.5 text-ink-400" />
          <span className={`${PANEL_TYPE.item} min-w-0 flex-1 text-ink-200`}>{botText(t, event)}</span>
          {withChannel && <span className={`${PANEL_TYPE.meta} shrink-0 text-ink-400`}>{event.channelId.replace(/^spec:/, '')}</span>}
          {event.at && <span className={`${PANEL_TYPE.meta} shrink-0 text-ink-400`}>{formatWhen(event.at, lang)}</span>}
        </li>
      ))}
    </ul>
  );
}
