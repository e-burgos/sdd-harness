'use client';

import { CircleCheck, Eye, EyeOff, Hash, Loader } from 'lucide-react';
import { useMemo } from 'react';
import type { Presence } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { matchesQuery } from '@/lib/nav/search';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { useNav } from '@/lib/nav/use-nav';
import { useStudio } from '../../BridgeProvider';
import { ModulePanel } from '../../shell/ModulePanel';
import { PanelGroup } from '../../shell/PanelGroup';
import { PanelRow } from '../../shell/PanelRow';
import { PanelAgent } from './PanelAgent';
import { approvalThreads, isBusy, runningCycles, runningThreads, threadsOfChannel, threadsOfSpecChannels, visibleConversations } from './derive';

const STATUS_META = { running: 'sidebar.chip.working', 'waiting-approval': 'sidebar.chip.approve', queued: 'sidebar.chip.queued' } as const;
const PRESENCE_META = { working: 'presence.working', waiting: 'presence.waiting', open: 'presence.open', idle: 'presence.idle' } as const;
const PRESENCE_RANK: Record<Presence['state'], number> = { working: 0, waiting: 1, open: 2, idle: 3 };

export function HomePanel() {
  const { t } = useT();
  const [query] = useModuleQuery('home');
  const snapshot = useStudio((s) => s.snapshot);
  const threads = useStudio((s) => s.threads);
  const presence = useStudio((s) => s.presence);
  const home = useNav((s) => s.home);
  const filter = useNav((s) => s.filters.homeConversations);
  const setFilter = useNav((s) => s.setFilter);
  const openHome = useNav((s) => s.openHome);
  const open = useNav((s) => s.open);

  const now = Date.now();
  const running = useMemo(() => runningThreads(threads).length + runningCycles(snapshot).length, [threads, snapshot]);
  const approvals = useMemo(() => approvalThreads(threads).length, [threads]);
  const activeThreadId = home.kind === 'thread' ? home.threadId : null;
  const allConversations = useMemo(() => visibleConversations(threads, 'all', now, null), [threads]);
  const conversations = useMemo(() => visibleConversations(threads, filter, now, activeThreadId), [threads, filter, activeThreadId]);

  const channels = [
    { id: 'general', label: t('home.channel.general'), count: threadsOfChannel(threads, 'general').length, selected: home.kind === 'channel' && home.channelId === 'general', go: () => openHome({ kind: 'channel', channelId: 'general' }) },
    { id: 'specs', label: t('home.channel.specs'), count: threadsOfSpecChannels(threads).length, selected: home.kind === 'specs-channel', go: () => openHome({ kind: 'specs-channel' }) },
    { id: 'fixes', label: t('home.channel.fixes'), count: threadsOfChannel(threads, 'fixes').length, selected: home.kind === 'channel' && home.channelId === 'fixes', go: () => openHome({ kind: 'channel', channelId: 'fixes' }) },
  ].filter((channel) => matchesQuery(query, channel.label, `#${channel.label}`));

  const shortcuts = [
    { id: 'running', label: t('home.running'), icon: Loader, count: running, selected: home.kind === 'inbox' && home.which === 'running' },
    { id: 'approvals', label: t('home.approvals'), icon: CircleCheck, count: approvals, selected: home.kind === 'inbox' && home.which === 'approvals' },
  ].filter((shortcut) => matchesQuery(query, shortcut.label));

  const shownConversations = conversations.filter((info) => matchesQuery(query, info.title, agentMeta(info.agent).name, info.channelId));
  const stateOf = (agent: string): Presence['state'] => presence.find((entry) => entry.agent === agent)?.state ?? 'idle';
  const agents = (snapshot?.agents ?? [])
    .filter((agent) => matchesQuery(query, agentMeta(agent.id).name, agent.id, agentMeta(agent.id).role))
    .sort((a, b) => PRESENCE_RANK[stateOf(a.id)] - PRESENCE_RANK[stateOf(b.id)]);

  const hasResults = shortcuts.length + channels.length + shownConversations.length + agents.length > 0;
  const searching = query.trim() !== '';
  const hiddenCount = allConversations.length - conversations.length;

  return (
    <ModulePanel moduleId="home" status={snapshot ? 'ready' : 'loading'} hasResults={hasResults}>
      {shortcuts.length > 0 && (
        <PanelGroup id="shortcuts" title={t('home.shortcuts')}>
          {shortcuts.map((shortcut) => (
            <PanelRow
              key={shortcut.id}
              label={shortcut.label}
              icon={shortcut.icon}
              meta={shortcut.count}
              selected={shortcut.selected}
              onClick={() => openHome({ kind: 'inbox', which: shortcut.id as 'running' | 'approvals' })}
            />
          ))}
        </PanelGroup>
      )}
      {channels.length > 0 && (
        <PanelGroup id="channels" title={t('home.channels')}>
          {channels.map((channel) => (
            <PanelRow key={channel.id} label={channel.label} icon={Hash} meta={channel.count > 0 ? channel.count : undefined} selected={channel.selected} onClick={channel.go} />
          ))}
        </PanelGroup>
      )}
      <PanelGroup id="conversations" title={t('home.conversations')} count={shownConversations.length}>
        {shownConversations.map((info) => (
          <PanelRow
            key={info.id}
            label={info.title}
            leading={<PanelAgent agent={info.agent} />}
            meta={isBusy(info.status) ? t(STATUS_META[info.status as keyof typeof STATUS_META]) : undefined}
            selected={info.id === activeThreadId}
            onClick={() => openHome({ kind: 'thread', threadId: info.id })}
          />
        ))}
        {shownConversations.length === 0 && !searching && (
          <PanelRow label={t(allConversations.length === 0 ? 'home.conversations.none' : 'home.conversations.noActive')} />
        )}
        {(filter === 'all' || hiddenCount > 0) && !searching && (
          <PanelRow
            label={filter === 'all' ? t('home.conversations.onlyActive') : t('home.conversations.showAll', { count: allConversations.length })}
            icon={filter === 'all' ? EyeOff : Eye}
            onClick={() => setFilter('homeConversations', filter === 'all' ? 'active' : 'all')}
          />
        )}
      </PanelGroup>
      <PanelGroup id="agents" title={t('home.agents')} count={agents.length}>
        {agents.map((agent) => {
          const state = stateOf(agent.id);
          return (
            <PanelRow
              key={agent.id}
              label={agentMeta(agent.id).name}
              leading={<PanelAgent agent={agent.id} state={state} />}
              meta={state === 'idle' ? undefined : t(PRESENCE_META[state])}
              ariaLabel={t('home.agents.open', { name: agentMeta(agent.id).name })}
              title={`${agentMeta(agent.id).name} · ${agentMeta(agent.id).role}`}
              onClick={() => open('agents', agent.id)}
            />
          );
        })}
        {agents.length === 0 && !searching && <PanelRow label={t('home.agents.none')} />}
      </PanelGroup>
    </ModulePanel>
  );
}
