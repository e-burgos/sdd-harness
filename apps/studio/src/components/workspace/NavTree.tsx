'use client';

import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import type { Presence } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { useT, type TFunction } from '@/lib/i18n/i18n';
import { ActivityIndicator, INDICATED_STATUSES } from './ActivityIndicator';
import type { NavNode, NavSection, NavThread } from '@/lib/store/nav-tree';
import type { CollapsedState } from '@/lib/use-collapsed-state';

export const VISIBLE_THREADS_PER_NODE = 25;

export const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';
export const rowClass = (active: boolean) =>
  `${focusRing} flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-sm ${active ? 'bg-accent-dim text-accent-300' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'}`;

export interface NavTreeHandlers {
  collapse: CollapsedState;
  stale: boolean;
  onSelectChannel(channelId: string): void;
  onOpenThread(thread: NavThread): void;
}

const STATUS_KEY = { 'in-progress': 'channel.status.in-progress', completed: 'channel.status.completed' } as const;

function nodeLabel(node: NavNode, t: TFunction): string {
  switch (node.kind) {
    case 'channel':
      return `# ${node.label}`;
    case 'dm':
      return agentMeta(node.label).name;
    case 'spec-none':
      return t('sidebar.noCycle');
    case 'fixes-older':
      return t('sidebar.olderFixes', { count: node.children.length });
    default:
      return node.label;
  }
}

export function NodeMarks({ node }: { node: NavNode }) {
  const { t } = useT();
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5">
      {node.needsAttention && (
        <>
          <AlertTriangle aria-hidden size={12} className="text-amberish" />
          <span className="sr-only">, {t('sidebar.needsAttention')}</span>
        </>
      )}
      {node.containsSelection && (
        <>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-400" />
          <span className="sr-only">, {t('sidebar.containsSelection')}</span>
        </>
      )}
      {node.threadCount > 0 && <span className="text-[10px] text-ink-500">{node.threadCount}</span>}
    </span>
  );
}

export function arrowKeyToggle(toggle: CollapsedState, node: NavNode, collapsed: boolean) {
  return (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && !collapsed) {
      e.preventDefault();
      toggle.setCollapsed(node.id, true, node.defaultCollapsed);
    } else if (e.key === 'ArrowRight' && collapsed) {
      e.preventDefault();
      toggle.setCollapsed(node.id, false, node.defaultCollapsed);
    }
  };
}

function ThreadRow({ thread, depth, h }: { thread: NavThread; depth: number; h: NavTreeHandlers }) {
  const { t } = useT();
  return (
    <button
      type="button"
      className={rowClass(thread.selected)}
      style={{ paddingLeft: 8 + depth * 12 }}
      aria-current={thread.selected ? 'true' : undefined}
      onClick={() => h.onOpenThread(thread)}
    >
      <ActivityIndicator status={thread.status} placement="row" />
      <span className="truncate">{thread.title}</span>
      {INDICATED_STATUSES.has(thread.status) && <span className="sr-only">, {t(`status.${thread.status}`)}</span>}
    </button>
  );
}

function ThreadList({ node, depth, h }: { node: NavNode; depth: number; h: NavTreeHandlers }) {
  const { t } = useT();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? node.threads : node.threads.slice(0, VISIBLE_THREADS_PER_NODE);
  const hidden = node.threads.length - shown.length;
  return (
    <>
      {shown.map((thread) => (
        <ThreadRow key={thread.id} thread={thread} depth={depth} h={h} />
      ))}
      {hidden > 0 && (
        <button type="button" className={`${rowClass(false)} text-xs`} style={{ paddingLeft: 8 + depth * 12 }} onClick={() => setShowAll(true)}>
          {t('sidebar.showMore', { count: hidden })}
        </button>
      )}
    </>
  );
}

function ActiveThreadRow({ thread, h }: { thread: NavThread; h: NavTreeHandlers }) {
  const { t } = useT();
  return (
    <button
      type="button"
      className={`${rowClass(thread.selected)} ${thread.status === 'waiting-approval' ? 'border-l-2 border-amberish' : ''}`}
      aria-current={thread.selected ? 'true' : undefined}
      onClick={() => h.onOpenThread(thread)}
    >
      <ActivityIndicator status={thread.status} placement="row" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{thread.title}</span>
        <span className="truncate text-[11px] text-ink-500" data-testid="active-thread-agents">
          {(thread.workingAgents.length > 0 ? thread.workingAgents : [thread.agent]).map((agent) => agentMeta(agent).name).join(', ')} · {t(`status.${thread.status}`)}
          {thread.tool && ` · ${thread.tool}`}
        </span>
      </span>
      {thread.pendingCount > 0 && <span className="shrink-0 rounded-full bg-ink-800 px-1.5 text-[10px] text-ink-300">{t('sidebar.pending', { count: thread.pendingCount })}</span>}
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
      {section.threads.length === 0 && <p className="px-2 py-1 text-xs text-ink-500">{t('sidebar.noActive')}</p>}
    </div>
  );
}

const hasContent = (node: NavNode) => node.children.length > 0 || node.threads.length > 0;
const EMPTY_KEY = { spec: 'sidebar.noCycles', cycle: 'sidebar.noThreads', fix: 'sidebar.noThreads' } as const;

export function NavNodeView({ node, depth, h, dmState }: { node: NavNode; depth: number; h: NavTreeHandlers; dmState(agent: string): Presence['state'] }) {
  const { t } = useT();
  const collapsed = h.collapse.isCollapsed(node.id, node.defaultCollapsed);
  const onKeyDown = arrowKeyToggle(h.collapse, node, collapsed);
  const label = nodeLabel(node, t);
  const regionId = `nav-${node.id}`;
  const collapsible = hasContent(node) || node.kind === 'spec' || node.kind === 'cycle' || node.kind === 'fix';
  const pad = { paddingLeft: 8 + depth * 12 };
  const toggleButton = (
    <button
      type="button"
      className={`${focusRing} shrink-0 rounded p-1 text-ink-500 hover:text-ink-100`}
      aria-label={t('sidebar.toggleNode', { name: label })}
      aria-expanded={!collapsed}
      aria-controls={collapsed ? undefined : regionId}
      onClick={() => h.collapse.toggle(node.id, node.defaultCollapsed)}
      onKeyDown={onKeyDown}
    >
      {collapsed ? <ChevronRight aria-hidden size={12} /> : <ChevronDown aria-hidden size={12} />}
    </button>
  );
  const statusKey = node.status && node.status in STATUS_KEY ? STATUS_KEY[node.status as keyof typeof STATUS_KEY] : null;
  const marks = collapsed ? <NodeMarks node={node} /> : null;
  const header =
    node.channelId !== null ? (
      <div className="flex min-w-0 items-center" style={{ paddingLeft: depth * 12 }}>
        {collapsible ? toggleButton : <span className="w-6 shrink-0" />}
        <button
          type="button"
          className={rowClass(node.selected)}
          aria-current={node.selected ? 'page' : undefined}
          aria-label={node.kind === 'dm' ? `${label}, ${t(PRESENCE_KEY[dmState(node.label)])}` : undefined}
          onClick={() => h.onSelectChannel(node.channelId as string)}
        >
          {node.kind === 'dm' && <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${DM_DOT[dmState(node.label)]}`} />}
          {node.kind === 'dm' ? (
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="truncate">{label}</span>
              <span className="truncate text-[10px] text-ink-400 font-mono font-normal">
                {agentMeta(node.label).role}
              </span>
            </div>
          ) : (
            <span className="truncate">{label}</span>
          )}
          {statusKey && <span className="sr-only">, {t(statusKey)}</span>}
        </button>
        {marks}
      </div>
    ) : (
      <button
        type="button"
        className={rowClass(false)}
        style={pad}
        aria-expanded={!collapsed}
        aria-controls={collapsed ? undefined : regionId}
        onClick={() => h.collapse.toggle(node.id, node.defaultCollapsed)}
        onKeyDown={onKeyDown}
      >
        {collapsed ? <ChevronRight aria-hidden size={12} /> : <ChevronDown aria-hidden size={12} />}
        <span className="truncate">{label}</span>
        {marks}
      </button>
    );
  const emptyKey = EMPTY_KEY[node.kind as keyof typeof EMPTY_KEY] ?? null;
  return (
    <div>
      {header}
      {!collapsed && collapsible && (
        <div id={regionId}>
          {node.children.map((child) => (
            <NavNodeView key={child.id} node={child} depth={depth + 1} h={h} dmState={dmState} />
          ))}
          <ThreadList node={node} depth={depth + 1} h={h} />
          {!hasContent(node) && emptyKey && (
            <p className="px-2 py-1 text-xs text-ink-500" style={{ paddingLeft: 8 + (depth + 1) * 12 }}>
              {t(emptyKey)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const DM_DOT = {
  working: 'bg-accent-400 motion-safe:animate-pulse',
  waiting: 'bg-amberish',
  open: 'bg-accent-500/60',
  idle: 'border border-ink-500',
};
const PRESENCE_KEY = { working: 'presence.working', waiting: 'presence.waiting', open: 'presence.open', idle: 'presence.idle' } as const;

const SECTION_KEY = { active: 'sidebar.active', channels: 'sidebar.channels', specs: 'sidebar.specs', fixes: 'sidebar.fixes', agents: 'sidebar.agents' } as const;
const SECTION_EMPTY = { specs: 'sidebar.noSpecs', fixes: 'sidebar.noFixes' } as const;

export function SectionView({ section, h, dmState }: { section: NavSection; h: NavTreeHandlers; dmState(agent: string): Presence['state'] }) {
  const { t } = useT();
  const collapsed = h.collapse.isCollapsed(section.id, section.defaultCollapsed);
  const onKeyDown = arrowKeyToggle(h.collapse, section, collapsed);
  const regionId = `nav-${section.id}`;
  const emptyKey = SECTION_EMPTY[section.key as keyof typeof SECTION_EMPTY];
  return (
    <section>
      <button
        type="button"
        className={`${focusRing} mb-1 flex w-full items-center gap-1 rounded px-2 text-left text-[11px] uppercase tracking-wider text-ink-500 hover:text-ink-300`}
        aria-expanded={!collapsed}
        aria-controls={collapsed ? undefined : regionId}
        onClick={() => h.collapse.toggle(section.id, section.defaultCollapsed)}
        onKeyDown={onKeyDown}
      >
        {collapsed ? <ChevronRight aria-hidden size={10} /> : <ChevronDown aria-hidden size={10} />}
        <span>{t(SECTION_KEY[section.key])}</span>
        {collapsed && <NodeMarks node={section} />}
      </button>
      {!collapsed && (
        <div id={regionId}>
          {section.key === 'active' && <ActiveThreads section={section} h={h} />}
          {section.children.map((node) => (
            <NavNodeView key={node.id} node={node} depth={0} h={h} dmState={dmState} />
          ))}
          {section.children.length === 0 && emptyKey && <p className="px-2 py-1 text-xs text-ink-500">{t(emptyKey)}</p>}
        </div>
      )}
    </section>
  );
}
