import {
  channelForDm,
  channelForSpec,
  dmAgentOfChannel,
  specIdOfChannel,
  type FixSummary,
  type SessionStatus,
  type ThreadInfo,
  type WorkspaceSnapshot,
} from '@sdd-studio/protocol';

export const VISIBLE_CLOSED_FIXES = 5;

export type NavNodeKind = 'section' | 'channel' | 'spec' | 'spec-none' | 'cycle' | 'fix' | 'fixes-older' | 'dm';
export type NavSectionKey = 'active' | 'channels' | 'specs' | 'fixes' | 'agents';

export interface NavView {
  channelId: string;
  threadId: string | null;
}

export interface NavThread {
  id: string;
  title: string;
  agent: string;
  status: SessionStatus;
  channelId: string;
  pendingCount: number;
  lastActivity: string;
  selected: boolean;
}

export interface NavNode {
  id: string;
  kind: NavNodeKind;
  label: string;
  title: string | null;
  status: string | null;
  channelId: string | null;
  defaultCollapsed: boolean;
  children: NavNode[];
  threads: NavThread[];
  threadCount: number;
  selected: boolean;
  containsSelection: boolean;
  needsAttention: boolean;
}

export type NavSection = NavNode & { kind: 'section'; key: NavSectionKey };

const ACTIVE_STATUSES: ReadonlySet<SessionStatus> = new Set(['waiting-approval', 'running', 'queued']);
const ACTIVE_RANK: Partial<Record<SessionStatus, number>> = { 'waiting-approval': 0, running: 1, queued: 2 };
const OPEN_FIX_STATUSES = new Set(['pending', 'in-progress']);
const IN_PROGRESS = 'in-progress';

const byRecency = (a: ThreadInfo, b: ThreadInfo) => b.lastActivity.localeCompare(a.lastActivity);
const cycleNumber = (cycle: string) => Number(cycle.slice(6));

interface Draft {
  node: NavNode;
  infos: ThreadInfo[];
}

function draft(init: Pick<NavNode, 'id' | 'kind' | 'label'> & Partial<Omit<NavNode, 'id' | 'kind' | 'label'>>): Draft {
  return {
    infos: [],
    node: {
      title: null,
      status: null,
      channelId: null,
      defaultCollapsed: false,
      children: [],
      threads: [],
      threadCount: 0,
      selected: false,
      containsSelection: false,
      needsAttention: false,
      ...init,
    },
  };
}

function finalize(d: Draft, view: NavView): NavNode {
  const node = d.node;
  node.threads = [...d.infos].sort(byRecency).map((i) => ({
    id: i.id,
    title: i.title,
    agent: i.agent,
    status: i.status,
    channelId: i.channelId,
    pendingCount: i.pendingCount,
    lastActivity: i.lastActivity,
    selected: view.threadId === i.id,
  }));
  node.selected = node.channelId !== null && view.threadId === null && view.channelId === node.channelId;
  node.containsSelection =
    node.selected ||
    node.threads.some((t) => t.selected) ||
    node.children.some((c) => c.containsSelection);
  node.needsAttention = node.threads.some((t) => t.status === 'waiting-approval') || node.children.some((c) => c.needsAttention);
  node.threadCount = node.threads.length + node.children.reduce((n, c) => n + c.threadCount, 0);
  return node;
}

function closedAtOf(fix: FixSummary) {
  return fix.closedAt ?? '';
}

function byClosedRecency(a: FixSummary, b: FixSummary) {
  return (
    closedAtOf(b).localeCompare(closedAtOf(a)) ||
    (b.createdAt ?? '').localeCompare(a.createdAt ?? '') ||
    b.id.localeCompare(a.id)
  );
}

export function buildNavTree(snapshot: WorkspaceSnapshot | null, threads: ThreadInfo[], view: NavView): NavSection[] {
  const channelDrafts = new Map<string, Draft>();
  const dmDrafts = new Map<string, Draft>();
  const specDrafts = new Map<string, { spec: Draft; none: Draft; cycles: Map<string, Draft> }>();
  const fixDrafts = new Map<string, Draft>();

  const channelDraft = (id: string) => {
    let d = channelDrafts.get(id);
    if (!d) channelDrafts.set(id, (d = draft({ id: `channel:${id}`, kind: 'channel', label: id, channelId: id })));
    return d;
  };
  const dmDraft = (agent: string) => {
    let d = dmDrafts.get(agent);
    if (!d) dmDrafts.set(agent, (d = draft({ id: `dm:${agent}`, kind: 'dm', label: agent, channelId: channelForDm(agent) })));
    return d;
  };
  const cycleDraft = (specId: string, cycle: string, status: string | null) => {
    const entry = specEntry(specId);
    let d = entry.cycles.get(cycle);
    if (!d) {
      entry.cycles.set(cycle, (d = draft({ id: `cycle:${specId}/${cycle}`, kind: 'cycle', label: cycle })));
    }
    if (status !== null) {
      d.node.status = status;
      d.node.defaultCollapsed = status !== IN_PROGRESS;
    } else if (d.node.status === null) {
      d.node.defaultCollapsed = true;
    }
    return d;
  };
  const specEntry = (specId: string) => {
    let entry = specDrafts.get(specId);
    if (!entry) {
      entry = {
        spec: draft({ id: `spec:${specId}`, kind: 'spec', label: specId, channelId: channelForSpec(specId), defaultCollapsed: true }),
        none: draft({ id: `spec-none:${specId}`, kind: 'spec-none', label: specId }),
        cycles: new Map(),
      };
      specDrafts.set(specId, entry);
    }
    return entry;
  };
  const fixDraft = (fixId: string) => {
    let d = fixDrafts.get(fixId);
    if (!d) fixDrafts.set(fixId, (d = draft({ id: `fix:${fixId}`, kind: 'fix', label: fixId, defaultCollapsed: true })));
    return d;
  };

  for (const spec of snapshot?.specs ?? []) {
    const entry = specEntry(spec.id);
    entry.spec.node.title = spec.title;
    entry.spec.node.status = spec.status;
    entry.spec.node.defaultCollapsed = spec.status !== IN_PROGRESS;
  }
  for (const c of snapshot?.cycles ?? []) cycleDraft(c.specId, c.cycle, c.status);
  for (const f of snapshot?.fixes ?? []) {
    const d = fixDraft(f.id);
    d.node.title = f.title;
    d.node.status = f.status;
    d.node.defaultCollapsed = !OPEN_FIX_STATUSES.has(f.status);
  }
  for (const a of snapshot?.agents ?? []) dmDraft(a.id);
  channelDraft('general');
  channelDraft('fixes');

  const knownFixes = new Set((snapshot?.fixes ?? []).map((f) => f.id));

  for (const info of threads) {
    const target = info.link.target;
    if (target.kind === 'cycle') {
      cycleDraft(target.specId, target.cycle, null).infos.push(info);
    } else if (target.kind === 'fix') {
      fixDraft(target.fixId).infos.push(info);
    } else {
      const specId = specIdOfChannel(info.channelId);
      const agent = dmAgentOfChannel(info.channelId);
      if (specId !== null) specEntry(specId).none.infos.push(info);
      else if (agent !== null) dmDraft(agent).infos.push(info);
      else channelDraft(info.channelId).infos.push(info);
    }
  }

  const sections: NavSection[] = [];
  const section = (key: NavSectionKey, children: NavNode[], rows: ThreadInfo[] = []): NavSection => {
    const d = draft({ id: `section:${key}`, kind: 'section', label: key });
    d.node.children = children;
    d.infos = rows;
    const node = finalize(d, view) as NavSection;
    node.key = key;
    if (key === 'active') node.threadCount = rows.length;
    sections.push(node);
    return node;
  };

  section(
    'active',
    [],
    threads
      .filter((t) => ACTIVE_STATUSES.has(t.status))
      .sort((a, b) => (ACTIVE_RANK[a.status] ?? 0) - (ACTIVE_RANK[b.status] ?? 0) || byRecency(a, b)),
  );

  const channelOrder = (id: string) => (id === 'general' ? 0 : id === 'fixes' ? 1 : 2);
  section(
    'channels',
    [...channelDrafts.values()]
      .sort((a, b) => channelOrder(a.node.channelId ?? '') - channelOrder(b.node.channelId ?? '') || a.node.label.localeCompare(b.node.label))
      .map((d) => finalize(d, view)),
  );

  const specChildren = [...specDrafts.entries()]
    .sort(([ia, a], [ib, b]) => Number(b.spec.node.status === IN_PROGRESS) - Number(a.spec.node.status === IN_PROGRESS) || ia.localeCompare(ib))
    .map(([, entry]) => {
      const cycles = [...entry.cycles.values()]
        .sort((a, b) => cycleNumber(b.node.label) - cycleNumber(a.node.label))
        .map((d) => finalize(d, view));
      const none = entry.none.infos.length > 0 ? [finalize(entry.none, view)] : [];
      entry.spec.node.children = [...cycles, ...none];
      return finalize(entry.spec, view);
    });
  section('specs', specChildren);

  const allFixes = [...fixDrafts.values()];
  const isOpen = (d: Draft) => d.node.status !== null && OPEN_FIX_STATUSES.has(d.node.status);
  const summaries = new Map((snapshot?.fixes ?? []).map((f) => [f.id, f]));
  const open = allFixes.filter(isOpen).sort((a, b) => b.node.label.localeCompare(a.node.label));
  const closed = allFixes
    .filter((d) => !isOpen(d))
    .sort((a, b) => {
      const sa = summaries.get(a.node.label);
      const sb = summaries.get(b.node.label);
      if (sa && sb) return byClosedRecency(sa, sb);
      return Number(!!sb) - Number(!!sa) || b.node.label.localeCompare(a.node.label);
    });
  const visibleClosed = closed.filter((d) => knownFixes.has(d.node.label)).slice(0, VISIBLE_CLOSED_FIXES);
  const visibleSet = new Set(visibleClosed);
  const older = closed.filter((d) => !visibleSet.has(d) && d.infos.length > 0);
  const fixChildren = [...open, ...visibleClosed].map((d) => finalize(d, view));
  if (older.length > 0) {
    const olderDraft = draft({ id: 'fixes:older', kind: 'fixes-older', label: 'older', defaultCollapsed: true });
    olderDraft.node.children = older.map((d) => finalize(d, view));
    fixChildren.push(finalize(olderDraft, view));
  }
  section('fixes', fixChildren);

  section(
    'agents',
    [...dmDrafts.values()].sort((a, b) => a.node.label.localeCompare(b.node.label)).map((d) => finalize(d, view)),
  );

  return sections;
}
