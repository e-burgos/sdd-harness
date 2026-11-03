'use client';

import { dmAgentOfChannel, specIdOfChannel } from '@sdd-studio/protocol';
import { useMemo, type ReactNode } from 'react';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { cycleForChannel } from '@/lib/store/selectors';
import { PANEL_TYPE } from '@/lib/typography-tokens';
import { useStudio } from '../../BridgeProvider';
import { EventRows, SectionTitle, ThreadRows } from './channel-sections';
import { homeChannelKind, recentEvents, threadsOfChannel, threadsOfSpecChannels } from './derive';
import { FixesSummary, SpecsSummary } from './summaries';
import { useBotHistory } from './use-bot-history';

export type ChannelTarget = { kind: 'channel'; channelId: string } | { kind: 'specs-channel' };

export function CenterHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <header className="flex min-h-12 shrink-0 items-center gap-3 border-b border-foreground/10 px-5 py-2">
      <h1 className={`${PANEL_TYPE.title} min-w-0 truncate`}>{title}</h1>
      {aside}
    </header>
  );
}

export function useChannelIds(target: ChannelTarget): string[] {
  const specs = useStudio((s) => s.snapshot?.specs);
  return useMemo(() => {
    if (target.kind === 'specs-channel') return (specs ?? []).map((spec) => `spec:${spec.id}`);
    return homeChannelKind(target.channelId) === 'dm' ? [] : [target.channelId];
  }, [target, specs]);
}

export function ChannelCenter({ target, composer, onOpenThread }: { target: ChannelTarget; composer: ReactNode; onOpenThread(id: string): void }) {
  const { t } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const threads = useStudio((s) => s.threads);
  const bot = useStudio((s) => s.bot);
  const channelIds = useChannelIds(target);
  useBotHistory(channelIds);

  const aggregated = target.kind === 'specs-channel';
  const channelId = target.kind === 'channel' ? target.channelId : null;
  const kind = channelId === null ? 'specs' : homeChannelKind(channelId);
  const list = useMemo(() => (channelId === null ? threadsOfSpecChannels(threads) : threadsOfChannel(threads, channelId)), [threads, channelId]);
  const events = useMemo(() => recentEvents(channelIds.map((id) => bot[id] ?? [])), [channelIds, bot]);

  const dmAgent = channelId === null ? null : dmAgentOfChannel(channelId);
  const specId = channelId === null ? null : specIdOfChannel(channelId);
  const cycle = channelId === null ? null : cycleForChannel(snapshot, channelId);
  const title = aggregated
    ? t('home.title.specs')
    : dmAgent
      ? t('home.title.dm', { name: agentMeta(dmAgent).name })
      : t('home.title.channel', { name: specId ?? channelId ?? '' });
  const aside = cycle ? <span className={`${PANEL_TYPE.meta} text-ink-300`}>{`${cycle.cycle} · ${cycle.flow} · ${t('cycle.progress', { done: cycle.tasksDone, total: cycle.tasksTotal })}`}</span> : undefined;

  return (
    <section aria-label={title} className="flex h-full min-w-0 flex-col">
      <CenterHeader title={title} aside={aside} />
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-4">
        {aggregated && snapshot && <SpecsSummary snapshot={snapshot} />}
        {kind === 'fixes' && snapshot && <FixesSummary fixes={snapshot.fixes} />}
        <section aria-label={t('home.threads')}>
          <SectionTitle>{t('home.threads')}</SectionTitle>
          <ThreadRows threads={list} onOpen={onOpenThread} emptyText={t('home.threads.none')} />
        </section>
        {!dmAgent && (
          <section aria-label={t('home.activity')}>
            <SectionTitle>{t('home.activity')}</SectionTitle>
            <EventRows events={events} withChannel={aggregated} emptyText={t('home.activity.none')} />
          </section>
        )}
        {aggregated && <p className={`${PANEL_TYPE.meta} text-ink-400`}>{t('home.specs.composerHint')}</p>}
      </div>
      {!aggregated && composer}
    </section>
  );
}
