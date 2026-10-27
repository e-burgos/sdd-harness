'use client';

import type { SessionStatus, ThreadInfo } from '@sdd-studio/protocol';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { matchesQuery } from '@/lib/nav/search';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { useNav } from '@/lib/nav/use-nav';
import { ModulePanel } from '../../shell/ModulePanel';
import { PanelGroup } from '../../shell/PanelGroup';
import { PanelNotice } from '../../shell/PanelNotice';
import { PanelRow } from '../../shell/PanelRow';
import { focusRing } from '../../shell/shell-context';
import { associationLabels, countByFilter, filterConversations, groupByCycle, MAP_FILTERS, type MapFilter } from './map-filters';
import { SwarmScopeGuard, useSwarmPlayback } from './swarm-playback';

const FILTER_LABEL = {
  all: 'module.map.filter.all',
  transversal: 'module.map.filter.transversal',
  cycle: 'module.map.filter.cycle',
  running: 'module.map.filter.running',
  ready: 'module.map.filter.ready',
} as const;

const STATUS_DOT: Record<SessionStatus, string> = {
  running: 'bg-emerald-400 motion-safe:animate-pulse',
  'waiting-approval': 'bg-amber-400',
  queued: 'bg-ink-400',
  idle: 'border border-ink-500',
  interrupted: 'border border-ink-500',
  error: 'bg-roseish',
};

function StatusDot({ status }: { status: SessionStatus }) {
  return <span aria-hidden data-status={status} className={`mx-1 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} />;
}

function MapPanelContent() {
  const { t } = useT();
  const { conversations, selectedThreadId, pick } = useSwarmPlayback();
  const filter = useNav((s) => s.filters.map);
  const setFilter = useNav((s) => s.setFilter);
  const startNewConversation = useNav((s) => s.startNewConversation);
  const [query] = useModuleQuery('map');

  const counts = useMemo(() => countByFilter(conversations), [conversations]);
  const shown = useMemo(
    () => filterConversations(conversations, filter).filter((info) => matchesQuery(query, info.title, info.id, agentMeta(info.agent).name, ...associationLabels(info))),
    [conversations, filter, query],
  );
  const groups = useMemo(
    () => (filter === 'cycle' ? groupByCycle(shown).map((group) => ({ ...group, id: `cycle:${group.key ?? 'none'}`, title: group.label ?? t('module.map.group.noCycle') })) : [{ id: 'conversations', key: null, label: null, title: t('module.map.group.conversations'), items: shown }]),
    [filter, shown, t],
  );

  const row = (info: ThreadInfo) => (
    <PanelRow
      key={info.id}
      label={info.title || info.id}
      title={info.title || info.id}
      leading={<StatusDot status={info.status} />}
      meta={agentMeta(info.agent).name}
      selected={selectedThreadId === info.id}
      onClick={() => pick(info.id)}
    />
  );

  return (
    <ModulePanel moduleId="map" hasResults={shown.length > 0}>
      <PanelRow label={t('module.map.new')} icon={Plus} onClick={startNewConversation} />
      <div role="group" aria-label={t('module.map.filters')} className="flex flex-wrap gap-1 px-1 py-2">
        {MAP_FILTERS.map((id: MapFilter) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter('map', id)}
            className={`${focusRing} flex h-6 items-center gap-1 rounded-full border px-2 text-meta transition-colors ${
              filter === id ? 'border-transparent bg-accent-dim text-ink-50' : 'border-foreground/10 text-ink-300 hover:bg-ink-800'
            }`}
          >
            <span>{t(FILTER_LABEL[id])}</span>
            <span className="text-micro text-ink-400">{counts[id]}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 && query.trim() === '' ? (
        <PanelNotice message={conversations.length === 0 ? t('mc.noConversations') : t('module.map.empty')} />
      ) : (
        groups.map((group) => (
          <PanelGroup key={group.id} id={group.id} title={group.title} count={group.items.length}>
            {group.items.map(row)}
          </PanelGroup>
        ))
      )}
    </ModulePanel>
  );
}

export function MapPanel() {
  return (
    <SwarmScopeGuard>
      <MapPanelContent />
    </SwarmScopeGuard>
  );
}
