'use client';

import { AlertTriangle, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import type { Presence } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { useT, type TFunction } from '@/lib/i18n/i18n';
import { ActivityIndicator, INDICATED_STATUSES } from './ActivityIndicator';
import { CycleTrail, PresenceAvatar, SeverityChip, SpecStatusDot } from './NavParts';
import type { NavNode, NavSection, NavThread } from '@/lib/store/nav-tree';
import type { CollapsedState } from '@/lib/use-collapsed-state';

export const VISIBLE_THREADS_PER_NODE = 25;

export const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';
export const rowClass = (active: boolean) =>
  `${focusRing} flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-sm ${active ? 'bg-accent-dim text-accent-300' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'}`;

export interface NavTreeHandlers {
  collapse: CollapsedState;
  stale: boolean;
  agentTask(agent: string): string | null;
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
      {node.threadCount > 0 && <span className="text-micro text-ink-500">{node.threadCount}</span>}
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

export function ThreadList({ node, depth, h }: { node: NavNode; depth: number; h: NavTreeHandlers }) {
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

const hasContent = (node: NavNode) => node.children.length > 0 || node.threads.length > 0;
const PRESENCE_KEY = { working: 'presence.working', waiting: 'presence.waiting', open: 'presence.open', idle: 'presence.idle' } as const;

function ConversationsLine({ count, depth }: { count: number; depth: number }) {
  const { t } = useT();
  return (
    <p data-testid="conversations-line" className="flex items-center gap-1.5 py-1 text-meta text-ink-500" style={{ paddingLeft: 8 + depth * 12 }}>
      <MessageSquare aria-hidden size={12} />
      {count === 0 ? t('sidebar.noThreads') : t(count === 1 ? 'sidebar.conversationsOne' : 'sidebar.conversations', { count })}
    </p>
  );
}

function AgentLines({ node, h, state }: { node: NavNode; h: NavTreeHandlers; state: Presence['state'] }) {
  const { t } = useT();
  const task = state === 'working' || state === 'waiting' ? h.agentTask(node.label) : null;
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="truncate">{agentMeta(node.label).name}</span>
      <span className="truncate text-micro font-normal text-ink-400" data-testid="agent-subline">
        {task ?? `${agentMeta(node.label).role} · ${t('sidebar.agentFree')}`}
      </span>
    </span>
  );
}

export function NavNodeView({ node, depth, h, dmState }: { node: NavNode; depth: number; h: NavTreeHandlers; dmState(agent: string): Presence['state'] }) {
  const { t } = useT();
  const collapsed = h.collapse.isCollapsed(node.id, node.defaultCollapsed);
  const onKeyDown = arrowKeyToggle(h.collapse, node, collapsed);
  const label = nodeLabel(node, t);
  const regionId = `nav-${node.id}`;
  const collapsible = hasContent(node) || node.kind === 'spec' || node.kind === 'cycle' || node.kind === 'fix';
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
  const state = node.kind === 'dm' ? dmState(node.label) : 'idle';
  const trail =
    node.kind === 'cycle' ? (
      <CycleTrail progress={node.progress} withCycle={false} />
    ) : node.kind === 'fix' ? (
      <span className="flex shrink-0 items-center gap-1.5 pl-1 pr-1">
        <SeverityChip severity={node.severity} />
        {node.status && <span className="text-micro text-ink-500">{node.status}</span>}
      </span>
    ) : null;
  const header =
    node.channelId !== null ? (
      <div className="flex min-w-0 items-center" style={{ paddingLeft: depth * 12 }}>
        {collapsible ? toggleButton : <span className="w-6 shrink-0" />}
        <button
          type="button"
          className={rowClass(node.selected)}
          aria-current={node.selected ? 'page' : undefined}
          aria-label={node.kind === 'dm' ? `${label}, ${t(PRESENCE_KEY[state])}` : undefined}
          onClick={() => h.onSelectChannel(node.channelId as string)}
        >
          {node.kind === 'spec' && <SpecStatusDot status={node.status} />}
          {node.kind === 'dm' && <PresenceAvatar agent={node.label} state={state} size={22} />}
          {node.kind === 'dm' ? (
            <AgentLines node={node} h={h} state={state} />
          ) : node.kind === 'spec' && node.progress ? (
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate">{label}</span>
              <span aria-hidden>
                <CycleTrail progress={node.progress} withCycle className="" />
              </span>
            </span>
          ) : (
            <span className="truncate">{label}</span>
          )}
          {statusKey && <span className="sr-only">, {t(statusKey)}</span>}
        </button>
        {marks}
        {trail}
      </div>
    ) : (
      <div className="flex min-w-0 items-center">
        <button
          type="button"
          className={rowClass(false)}
          style={{ paddingLeft: 8 + depth * 12 }}
          title={node.title ?? undefined}
          aria-expanded={!collapsed}
          aria-controls={collapsed ? undefined : regionId}
          onClick={() => h.collapse.toggle(node.id, node.defaultCollapsed)}
          onKeyDown={onKeyDown}
        >
          {collapsed ? <ChevronRight aria-hidden size={12} /> : <ChevronDown aria-hidden size={12} />}
          <span className="truncate">{label}</span>
        </button>
        {marks}
        {trail}
      </div>
    );
  const emptyKey = node.kind === 'spec' && !hasContent(node) ? 'sidebar.noCycles' : null;
  return (
    <div data-node-id={node.id}>
      {header}
      {!collapsed && collapsible && (
        <div id={regionId}>
          {node.children.map((child) => (
            <NavNodeView key={child.id} node={child} depth={depth + 1} h={h} dmState={dmState} />
          ))}
          <ThreadList node={node} depth={depth + 1} h={h} />
          {emptyKey && (
            <p className="py-1 text-xs text-ink-500" style={{ paddingLeft: 8 + (depth + 1) * 12 }}>
              {t(emptyKey)}
            </p>
          )}
          {node.kind === 'spec' && <ConversationsLine count={node.threadCount} depth={depth + 1} />}
        </div>
      )}
    </div>
  );
}
