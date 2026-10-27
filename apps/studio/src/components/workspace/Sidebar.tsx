'use client';

import { PanelLeftClose } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { AuthMode, Presence } from '@sdd-studio/protocol';
import { useT, type TFunction } from '@/lib/i18n/i18n';
import { filterNavTree } from '@/lib/store/nav-filter';
import { currentTaskOf, summarizeNavTree, type NavSummary } from '@/lib/store/nav-summary';
import { buildNavTree, type NavSection, type NavThread, type NavView } from '@/lib/store/nav-tree';
import { useCollapsedState, type CollapsedState } from '@/lib/use-collapsed-state';
import type { ConnectionState } from '@/lib/bridge/client';
import { useBridge, useStudio } from '../BridgeProvider';
import { AuthPanel } from './AuthPanel';
import { SectionView } from './NavSections';
import { focusRing, type NavTreeHandlers } from './NavTree';
import { SidebarHeader } from './SidebarHeader';
import { SidebarRail } from './SidebarRail';

export interface SidebarViewProps {
  project: string;
  kitVersion: string | null;
  authMode: AuthMode | null;
  connection: ConnectionState['status'];
  tree: NavSection[];
  presence: Presence[];
  onSelectChannel(channelId: string): void;
  onOpenThread(thread: NavThread): void;
  onNewConversation?(): void;
  authSlot?: ReactNode;
  onCollapse?(): void;
  iconsOnly?: boolean;
  onToggleIcons?(): void;
}

const ALWAYS_OPEN: CollapsedState['isCollapsed'] = () => false;

function summaryOf(section: NavSection, stats: NavSummary, t: TFunction): string | null {
  switch (section.key) {
    case 'active':
      return String(stats.active);
    case 'specs':
      return stats.specsTotal === 0 ? null : t(stats.specsActive === 1 ? 'sidebar.summary.specsOne' : 'sidebar.summary.specs', { active: stats.specsActive, total: stats.specsTotal });
    case 'fixes':
      return stats.fixesOpen === 0 ? null : t(stats.fixesOpen === 1 ? 'sidebar.summary.fixesOne' : 'sidebar.summary.fixes', { count: stats.fixesOpen });
    case 'agents':
      return stats.agentsWorking === 0 ? null : t('sidebar.summary.agents', { count: stats.agentsWorking });
    default:
      return null;
  }
}

export function SidebarView(p: SidebarViewProps) {
  const { t } = useT();
  const collapse = useCollapsedState(p.project);
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';
  const stats = useMemo(() => summarizeNavTree(p.tree, p.presence), [p.tree, p.presence]);
  const visible = useMemo(
    () => filterNavTree(p.tree, query).filter((section) => section.key !== 'active' || section.threads.length > 0),
    [p.tree, query],
  );
  const dmState = (agent: string) => p.presence.find((x) => x.agent === agent)?.state ?? 'idle';

  if (p.iconsOnly) {
    return (
      <SidebarRail
        tree={p.tree.filter((section) => section.key !== 'active' || section.threads.length > 0)}
        dmState={dmState}
        onSelectChannel={p.onSelectChannel}
        onOpenThread={p.onOpenThread}
        onNewConversation={p.onNewConversation}
        onCollapse={p.onCollapse}
        onExpand={() => p.onToggleIcons?.()}
      />
    );
  }

  const handlers: NavTreeHandlers = {
    collapse: searching ? { ...collapse, isCollapsed: ALWAYS_OPEN } : collapse,
    stale: p.connection !== 'open',
    agentTask: (agent) => currentTaskOf(p.tree, agent),
    onSelectChannel: p.onSelectChannel,
    onOpenThread: p.onOpenThread,
  };
  return (
    <nav className="flex h-full min-h-0 flex-col overflow-hidden border-r border-ink-800 bg-ink-900">
      <SidebarHeader
        project={p.project}
        kitVersion={p.kitVersion}
        authMode={p.authMode}
        connection={p.connection}
        query={query}
        onQueryChange={setQuery}
        onNewConversation={p.onNewConversation}
        onCollapse={p.onCollapse}
        authSlot={p.authSlot}
      />
      <div data-testid="sidebar-tree" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-2">
        {visible.map((section) => (
          <SectionView key={section.id} section={section} h={handlers} dmState={dmState} summary={searching ? null : summaryOf(section, stats, t)} />
        ))}
        {searching && visible.length === 0 && (
          <p data-testid="sidebar-no-results" className="px-2 py-1 text-xs text-ink-500">
            {t('sidebar.noResults', { query: query.trim() })}
          </p>
        )}
      </div>
      <footer className="shrink-0 border-t border-ink-800 p-2">
        {p.onToggleIcons && (
          <button type="button" className={`${focusRing} flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-ui text-ink-400 hover:bg-ink-800 hover:text-ink-100`} onClick={p.onToggleIcons}>
            <PanelLeftClose aria-hidden size={14} />
            {t('sidebar.collapseIcons')}
          </button>
        )}
      </footer>
    </nav>
  );
}

export interface SidebarProps {
  view: NavView;
  onSelectChannel(channelId: string): void;
  onOpenThread(thread: NavThread): void;
  onNewConversation?(): void;
  onCollapse?(): void;
  iconsOnly?: boolean;
  onToggleIcons?(): void;
}

export function Sidebar({ view, onSelectChannel, onOpenThread, onNewConversation, onCollapse, iconsOnly, onToggleIcons }: SidebarProps) {
  const { connection, authMode } = useBridge();
  const snapshot = useStudio((s) => s.snapshot);
  const presence = useStudio((s) => s.presence);
  const threads = useStudio((s) => s.threads);
  const tree = useMemo(
    () => buildNavTree(snapshot, Object.values(threads).flatMap((t) => (t.info ? [t.info] : [])), view, presence),
    [snapshot, threads, view, presence],
  );
  const welcome = connection.status === 'open' ? connection.welcome : null;
  return (
    <SidebarView
      project={snapshot?.project ?? welcome?.workspace.project ?? '…'}
      kitVersion={snapshot?.kitVersion ?? null}
      authMode={authMode ?? welcome?.authMode ?? null}
      authSlot={<AuthPanel />}
      connection={connection.status}
      tree={tree}
      presence={presence}
      onSelectChannel={onSelectChannel}
      onOpenThread={onOpenThread}
      onNewConversation={onNewConversation}
      onCollapse={onCollapse}
      iconsOnly={iconsOnly}
      onToggleIcons={onToggleIcons}
    />
  );
}
