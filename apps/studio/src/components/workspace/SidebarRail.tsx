'use client';

import { Tooltip } from '@e-burgos/tucu-ui';
import { ChevronsRight, FileText, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Presence } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import type { NavNode, NavSection, NavThread } from '@/lib/store/nav-tree';
import { PresenceAvatar, SpecStatusDot } from './NavParts';
import { SECTION_ICON, SECTION_KEY } from './NavSections';
import { NewConversationIconButton } from './SidebarHeader';
import { PanelToggle } from './PanelRail';
import { focusRing } from './NavTree';

export const RAIL_ICONS_WIDTH = '52px';

function RailItem({ label, selected = false, tooltip = true, dot, onClick, children }: { label: string; selected?: boolean; tooltip?: boolean; dot?: ReactNode; onClick(): void; children: ReactNode }) {
  const button = (
    <button
      type="button"
      aria-label={label}
      aria-current={selected ? 'page' : undefined}
      onClick={onClick}
      className={`${focusRing} relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ui ${selected ? 'bg-accent-dim text-accent-300' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'}`}
    >
      {children}
      {dot && <span className="absolute -right-0.5 -top-0.5 flex">{dot}</span>}
    </button>
  );
  return tooltip ? (
    <Tooltip size="xs" arrow={false} content={label} placement="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}

function SectionIcon({ section, onExpand }: { section: NavSection; onExpand(): void }) {
  const { t } = useT();
  const Icon: LucideIcon = SECTION_ICON[section.key];
  return (
    <RailItem label={t(SECTION_KEY[section.key])} onClick={onExpand}>
      <Icon aria-hidden size={15} />
    </RailItem>
  );
}

const stateOfThread = (thread: NavThread): Presence['state'] => (thread.status === 'running' ? 'working' : thread.status === 'waiting-approval' ? 'waiting' : 'open');

export interface SidebarRailProps {
  tree: NavSection[];
  dmState(agent: string): Presence['state'];
  onSelectChannel(channelId: string): void;
  onOpenThread(thread: NavThread): void;
  onNewConversation?(): void;
  onCollapse?(): void;
  onExpand(): void;
}

function railNodes(section: NavSection, p: SidebarRailProps) {
  if (section.key === 'active') {
    return section.threads.map((thread) => (
      <RailItem key={thread.id} label={thread.title} selected={thread.selected} tooltip={false} onClick={() => p.onOpenThread(thread)}>
        <PresenceAvatar agent={thread.workingAgents[0] ?? thread.agent} state={stateOfThread(thread)} size={22} />
      </RailItem>
    ));
  }
  if (section.key === 'fixes') return [];
  return section.children.map((node: NavNode) => {
    const channelId = node.channelId;
    if (channelId === null) return null;
    if (section.key === 'agents') {
      return (
        <RailItem key={node.id} label={agentMeta(node.label).name} selected={node.selected} tooltip={false} onClick={() => p.onSelectChannel(channelId)}>
          <PresenceAvatar agent={node.label} state={p.dmState(node.label)} size={22} />
        </RailItem>
      );
    }
    if (section.key === 'specs') {
      return (
        <RailItem key={node.id} label={node.label} selected={node.selected} dot={<SpecStatusDot status={node.status} />} onClick={() => p.onSelectChannel(channelId)}>
          <FileText aria-hidden size={15} />
        </RailItem>
      );
    }
    return (
      <RailItem
        key={node.id}
        label={`# ${node.label}`}
        selected={node.selected}
        dot={node.needsAttention ? <span aria-hidden className="h-2 w-2 rounded-full bg-amberish" /> : undefined}
        onClick={() => p.onSelectChannel(channelId)}
      >
        <span aria-hidden className="font-medium uppercase">{node.label.slice(0, 1)}</span>
      </RailItem>
    );
  });
}

export function SidebarRail(p: SidebarRailProps) {
  const { t } = useT();
  return (
    <nav data-testid="sidebar-rail" aria-label={t('sidebar.railLabel')} className="flex h-full min-h-0 flex-col items-center overflow-hidden border-r border-ink-800 bg-ink-900 py-3">
      <div className="flex shrink-0 flex-col items-center gap-2">
        {p.onCollapse && <PanelToggle label={t('panel.sidebar.collapse')} side="left" onClick={p.onCollapse} />}
        {p.onNewConversation && <NewConversationIconButton onClick={p.onNewConversation} />}
      </div>
      <div data-testid="sidebar-tree" className="mt-3 flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto overscroll-contain">
        {p.tree.map((section) => (
          <div key={section.id} className="flex flex-col items-center gap-1 border-t border-ink-800 pt-1 first:border-t-0 first:pt-0">
            <SectionIcon section={section} onExpand={p.onExpand} />
            {railNodes(section, p)}
          </div>
        ))}
      </div>
      <div className="shrink-0 pt-2">
        <RailItem label={t('sidebar.expandIcons')} onClick={p.onExpand}>
          <ChevronsRight aria-hidden size={15} />
        </RailItem>
      </div>
    </nav>
  );
}
