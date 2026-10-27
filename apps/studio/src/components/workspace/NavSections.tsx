'use client';

import { AlertTriangle, ChevronDown, ChevronRight, FileText, Hash, Users, Wrench, Zap, type LucideIcon } from 'lucide-react';
import type { Presence } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import type { NavNode, NavSection, NavSectionKey, NavThread } from '@/lib/store/nav-tree';
import { PresenceAvatar, ThreadStatusChip } from './NavParts';
import { NavNodeView, NodeMarks, ThreadList, arrowKeyToggle, focusRing, rowClass, type NavTreeHandlers } from './NavTree';

export const SECTION_ICON: Record<NavSectionKey, LucideIcon> = { active: Zap, channels: Hash, specs: FileText, fixes: Wrench, agents: Users };
export const SECTION_KEY = { active: 'sidebar.active', channels: 'sidebar.channels', specs: 'sidebar.specs', fixes: 'sidebar.fixes', agents: 'sidebar.agents' } as const;
const SECTION_EMPTY = { specs: 'sidebar.noSpecs', fixes: 'sidebar.noFixes' } as const;

const chipClass = (selected: boolean) =>
  `${focusRing} inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-ui ${
    selected ? 'border-accent-400 bg-accent-dim text-accent-300' : 'border-ink-700 text-ink-300 hover:bg-ink-800 hover:text-ink-100'
  }`;

function ChannelChips({ nodes, h }: { nodes: NavNode[]; h: NavTreeHandlers }) {
  const { t } = useT();
  const current = nodes.find((n) => n.containsSelection);
  return (
    <>
      <div className="flex flex-wrap gap-1.5 px-2 py-1" data-testid="channel-chips">
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            className={chipClass(node.selected)}
            aria-current={node.selected ? 'page' : undefined}
            onClick={() => h.onSelectChannel(node.channelId as string)}
          >
            <span className="truncate">{`# ${node.label}`}</span>
            {node.needsAttention && <AlertTriangle aria-hidden size={11} className="text-amberish" />}
            {node.threadCount > 0 && (
              <>
                <span aria-hidden className="font-mono text-micro text-ink-400">{node.threadCount}</span>
                <span className="sr-only">, {t(node.threadCount === 1 ? 'sidebar.conversationsOne' : 'sidebar.conversations', { count: node.threadCount })}</span>
              </>
            )}
          </button>
        ))}
      </div>
      {current && current.threads.length > 0 && <ThreadList node={current} depth={0} h={h} />}
    </>
  );
}

function ActiveThreadRow({ thread, h }: { thread: NavThread; h: NavTreeHandlers }) {
  const { t } = useT();
  const waiting = thread.status === 'waiting-approval';
  const agents = thread.workingAgents.length > 0 ? thread.workingAgents : [thread.agent];
  return (
    <button
      type="button"
      className={`${rowClass(thread.selected)} ${waiting ? 'rounded-l-none border-l-2 border-amberish' : ''}`}
      aria-current={thread.selected ? 'true' : undefined}
      onClick={() => h.onOpenThread(thread)}
    >
      <PresenceAvatar agent={agents[0]!} state={thread.status === 'running' ? 'working' : waiting ? 'waiting' : 'open'} size={22} />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate">{thread.title}</span>
        <span className="truncate text-micro text-ink-500" data-testid="active-thread-agents">
          {agents.map((agent) => agentMeta(agent).name).join(', ')}
          {thread.tool && ` · ${thread.tool}`}
        </span>
      </span>
      {thread.pendingCount > 0 && <span className="shrink-0 rounded-full bg-ink-800 px-1.5 text-micro text-ink-300">{t('sidebar.pending', { count: thread.pendingCount })}</span>}
      <ThreadStatusChip status={thread.status} />
    </button>
  );
}

function ActiveThreads({ section, h }: { section: NavSection; h: NavTreeHandlers }) {
  const { t } = useT();
  return (
    <div className={h.stale ? 'opacity-60' : undefined}>
      {h.stale && <p className="px-2 py-1 text-xs text-amberish">{t('sidebar.stale')}</p>}
      {section.threads.map((thread) => (
        <ActiveThreadRow key={thread.id} thread={thread} h={h} />
      ))}
    </div>
  );
}

export function SectionView({ section, h, dmState, summary }: { section: NavSection; h: NavTreeHandlers; dmState(agent: string): Presence['state']; summary: string | null }) {
  const { t } = useT();
  const collapsed = h.collapse.isCollapsed(section.id, section.defaultCollapsed);
  const onKeyDown = arrowKeyToggle(h.collapse, section, collapsed);
  const regionId = `nav-${section.id}`;
  const emptyKey = SECTION_EMPTY[section.key as keyof typeof SECTION_EMPTY];
  const Icon = SECTION_ICON[section.key];
  return (
    <section>
      <div className="mb-1 flex items-center gap-2 px-1">
        <button
          type="button"
          className={`${focusRing} flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 text-left text-ui font-medium text-ink-300 hover:text-ink-100`}
          aria-expanded={!collapsed}
          aria-controls={collapsed ? undefined : regionId}
          onClick={() => h.collapse.toggle(section.id, section.defaultCollapsed)}
          onKeyDown={onKeyDown}
        >
          {collapsed ? <ChevronRight aria-hidden size={12} /> : <ChevronDown aria-hidden size={12} />}
          <Icon aria-hidden size={13} className="shrink-0 text-ink-400" />
          <span className="truncate">{t(SECTION_KEY[section.key])}</span>
          {collapsed && <NodeMarks node={section} />}
        </button>
        {summary && (
          <span data-testid="section-summary" className="shrink-0 text-meta text-ink-500">
            {summary}
          </span>
        )}
      </div>
      {!collapsed && (
        <div id={regionId}>
          {section.key === 'active' && <ActiveThreads section={section} h={h} />}
          {section.key === 'channels' && <ChannelChips nodes={section.children} h={h} />}
          {section.key !== 'channels' &&
            section.children.map((node) => <NavNodeView key={node.id} node={node} depth={0} h={h} dmState={dmState} />)}
          {section.children.length === 0 && emptyKey && <p className="px-2 py-1 text-xs text-ink-500">{t(emptyKey)}</p>}
        </div>
      )}
    </section>
  );
}
