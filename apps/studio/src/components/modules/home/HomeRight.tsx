'use client';

import { useMemo, useState } from 'react';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { PANEL_TYPE } from '@/lib/typography-tokens';
import { activityOf } from '@/lib/store/activity';
import { useStudio } from '../../BridgeProvider';
import { RightPanelFrame } from '../../shell/RightPanelFrame';
import { StatusBadge } from '../../workspace/StatusBadge';
import { useChannelIds, type ChannelTarget } from './ChannelCenter';
import { EventRows, SectionTitle } from './channel-sections';
import { HomeDetails } from './HomeDetails';
import { homeChannelKind, recentEvents } from './derive';
import { PanelAgent } from './PanelAgent';
import { PanelTabs } from './PanelTabs';
import { useBotHistory } from './use-bot-history';

type Tab = 'activity' | 'details';

const PRESENCE_KEY = { working: 'presence.working', waiting: 'presence.waiting', open: 'presence.open', idle: 'presence.idle' } as const;

export function HomeRight() {
  const { t } = useT();
  const home = useNav((s) => s.home);
  const threads = useStudio((s) => s.threads);
  const presence = useStudio((s) => s.presence);
  const bot = useStudio((s) => s.bot);
  const [tab, setTab] = useState<Tab>('activity');

  const threadChannel = home.kind === 'thread' ? threads[home.threadId]?.info?.channelId ?? null : null;
  const target: ChannelTarget =
    home.kind === 'specs-channel' ? home : { kind: 'channel', channelId: home.kind === 'channel' ? home.channelId : (threadChannel ?? 'general') };
  const channelIds = useChannelIds(target);
  useBotHistory(channelIds);

  const inScope = (threadId: string): boolean => {
    if (home.kind === 'thread') return threadId === home.threadId;
    if (home.kind === 'inbox') return true;
    const channelId = threads[threadId]?.info?.channelId ?? '';
    if (home.kind === 'specs-channel') return homeChannelKind(channelId) === 'specs';
    return home.channelId === 'general' ? true : channelId === home.channelId;
  };

  const working = useMemo(() => activityOf(threads, presence).filter((entry) => inScope(entry.threadId)), [threads, presence, home]);
  const events = useMemo(() => recentEvents(channelIds.map((id) => bot[id] ?? []), 20), [channelIds, bot]);

  return (
    <RightPanelFrame>
      <div className="mb-3">
        <PanelTabs<Tab>
          label={t('home.right.tabs')}
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'activity', label: t('home.right.activity') },
            { id: 'details', label: t('home.right.details') },
          ]}
        />
      </div>
      {tab === 'activity' ? (
        <div className="space-y-5" data-testid="home-right-activity">
          <section aria-label={t('home.activity.working')}>
            <SectionTitle>{t('home.activity.working')}</SectionTitle>
            {working.length === 0 ? (
              <p className={`${PANEL_TYPE.item} text-ink-300`}>{t('home.activity.nobody')}</p>
            ) : (
              <ul className="space-y-3">
                {working.map((entry) => (
                  <li key={entry.threadId} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`${PANEL_TYPE.item} min-w-0 flex-1 truncate`} title={entry.title}>
                        {entry.title}
                      </span>
                      <StatusBadge status={entry.status} />
                    </div>
                    <ul className="space-y-1">
                      {entry.agents.map((agent) => (
                        <li key={agent.agent} className="flex items-center gap-2">
                          <PanelAgent agent={agent.agent} state={agent.state} />
                          <span className={`${PANEL_TYPE.item} min-w-0 flex-1 truncate`}>{agentMeta(agent.agent).name}</span>
                          <span className={`${PANEL_TYPE.meta} shrink-0 text-ink-400`}>{agent.tool ?? t(PRESENCE_KEY[agent.state])}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {home.kind !== 'inbox' && home.kind !== 'thread' && (
            <section aria-label={t('home.activity.events')}>
              <SectionTitle>{t('home.activity.events')}</SectionTitle>
              <EventRows events={events} withChannel={home.kind === 'specs-channel'} emptyText={t('home.activity.none')} />
            </section>
          )}
        </div>
      ) : (
        <HomeDetails />
      )}
    </RightPanelFrame>
  );
}
