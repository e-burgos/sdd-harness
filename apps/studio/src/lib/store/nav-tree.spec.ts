import type { ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { buildNavTree, type NavNode, type NavSection } from './nav-tree';

const options = { agent: 'a', model: 'kit' as const, effort: null, permissionMode: 'default' as const };
const thread = (over: Partial<ThreadInfo> & { id: string }): ThreadInfo => ({
  channelId: 'general', title: over.id, agent: 'sdd-planner', options, status: 'idle', createdAt: '1', lastActivity: '2026-01-01',
  link: { target: { kind: 'none' }, source: 'legacy' }, pendingCount: 0, ...over,
});
const cycleLink = (specId: string, cycle: string): ThreadInfo['link'] => ({ target: { kind: 'cycle', specId, cycle }, source: 'auto' });
const fixLink = (fixId: string): ThreadInfo['link'] => ({ target: { kind: 'fix', fixId }, source: 'auto' });
const fix = (id: string, status: string, closedAt: string | null = null, createdAt: string | null = '2026-01-01') =>
  ({ id, title: id, status, severity: null, specId: null, createdAt, closedAt });

const snapshot: WorkspaceSnapshot = {
  project: 'p', profile: 'team', kitVersion: null, gateMode: 'block', pricing: null, stale: [], skills: [],
  agents: [{ id: 'sdd-planner', description: '', model: null, source: 'sdd', path: 'p' }],
  specs: [
    { id: 's2', title: 'Dos', status: 'completed', folder: 'f', module: null, app: null, dependsOn: [] },
    { id: 's1', title: 'Uno', status: 'in-progress', folder: 'f', module: null, app: null, dependsOn: [] },
  ],
  cycles: [
    { specId: 's1', cycle: 'cycle-01', status: 'completed', flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0 },
    { specId: 's1', cycle: 'cycle-02', status: 'in-progress', flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0 },
  ],
  fixes: [],
};
const view = { channelId: 'general', threadId: null };
const section = (tree: NavSection[], key: string) => tree.find((s) => s.key === key)!;
const ids = (nodes: NavNode[]) => nodes.map((n) => n.id);
const flatThreadIds = (n: NavNode): string[] => [...n.threads.map((t) => t.id), ...n.children.flatMap(flatThreadIds)];

describe('buildNavTree', () => {
  it('returns the five sections in order and keeps spec channels out of CHANNELS', () => {
    const tree = buildNavTree(snapshot, [], view);
    expect(tree.map((s) => s.key)).toEqual(['active', 'channels', 'specs', 'fixes', 'agents']);
    expect(ids(section(tree, 'channels').children)).toEqual(['channel:general', 'channel:fixes']);
    expect(ids(section(tree, 'agents').children)).toEqual(['dm:sdd-planner']);
  });

  it('orders in-progress specs first and cycles by number descending', () => {
    const specs = section(buildNavTree(snapshot, [], view), 'specs').children;
    expect(ids(specs)).toEqual(['spec:s1', 'spec:s2']);
    expect(ids(specs[0]!.children)).toEqual(['cycle:s1/cycle-02', 'cycle:s1/cycle-01']);
    expect(specs.map((s) => s.defaultCollapsed)).toEqual([false, true]);
    expect(specs[0]!.children.map((c) => c.defaultCollapsed)).toEqual([false, true]);
    expect(specs[0]!.channelId).toBe('spec:s1');
  });

  it('places every thread exactly once according to its link and channel', () => {
    const threads = [
      thread({ id: 'cyc', channelId: 'spec:s1', link: cycleLink('s1', 'cycle-02') }),
      thread({ id: 'nocycle', channelId: 'spec:s1' }),
      thread({ id: 'fixed', channelId: 'fixes', link: fixLink('FIX-a') }),
      thread({ id: 'gen' }),
      thread({ id: 'fixchan', channelId: 'fixes' }),
      thread({ id: 'dm', channelId: 'dm:sdd-planner' }),
      thread({ id: 'cross', channelId: 'general', link: cycleLink('s2', 'cycle-01') }),
    ];
    const tree = buildNavTree({ ...snapshot, fixes: [fix('FIX-a', 'in-progress')] }, threads, view);
    const everywhere = ['channels', 'specs', 'fixes', 'agents'].flatMap((k) => flatThreadIds(section(tree, k)));
    expect(everywhere.sort()).toEqual(threads.map((t) => t.id).sort());
    const s1 = section(tree, 'specs').children[0]!;
    expect(s1.children.find((c) => c.id === 'cycle:s1/cycle-02')!.threads.map((t) => t.id)).toEqual(['cyc']);
    expect(s1.children.find((c) => c.id === 'spec-none:s1')!.threads.map((t) => t.id)).toEqual(['nocycle']);
    expect(section(tree, 'fixes').children[0]!.threads.map((t) => t.id)).toEqual(['fixed']);
    expect(section(tree, 'agents').children[0]!.threads.map((t) => t.id)).toEqual(['dm']);
    expect(section(tree, 'specs').children[1]!.children[0]!.id).toBe('cycle:s2/cycle-01');
  });

  it('keeps threads of unknown specs, cycles and fixes reachable', () => {
    const threads = [
      thread({ id: 'ghost-spec', channelId: 'spec:gone' }),
      thread({ id: 'ghost-cycle', link: cycleLink('s1', 'cycle-09') }),
      thread({ id: 'ghost-fix', link: fixLink('FIX-gone') }),
    ];
    const tree = buildNavTree(snapshot, threads, view);
    const all = ['specs', 'fixes'].flatMap((k) => flatThreadIds(section(tree, k)));
    expect(all.sort()).toEqual(['ghost-cycle', 'ghost-fix', 'ghost-spec']);
    expect(ids(section(tree, 'fixes').children)).toEqual(['fixes:older']);
  });

  it('shows open fixes and the five most recently closed, moving older closed fixes with threads to Fixes anteriores', () => {
    const fixes = [
      fix('FIX-open', 'in-progress'),
      ...Array.from({ length: 7 }, (_, i) => fix(`FIX-c${i}`, 'resolved', `2026-02-0${i + 1}`)),
    ];
    const threads = [thread({ id: 'old-chat', link: fixLink('FIX-c0') }), thread({ id: 'new-chat', link: fixLink('FIX-c6') })];
    const fixesNode = section(buildNavTree({ ...snapshot, fixes }, threads, view), 'fixes');
    expect(ids(fixesNode.children)).toEqual(['fix:FIX-open', 'fix:FIX-c6', 'fix:FIX-c5', 'fix:FIX-c4', 'fix:FIX-c3', 'fix:FIX-c2', 'fixes:older']);
    const older = fixesNode.children.at(-1)!;
    expect(ids(older.children)).toEqual(['fix:FIX-c0']);
    expect(older.defaultCollapsed).toBe(true);
    expect(fixesNode.children[0]!.defaultCollapsed).toBe(false);
    expect(fixesNode.children[1]!.defaultCollapsed).toBe(true);
  });

  it('omits Fixes anteriores when no hidden closed fix has threads', () => {
    const fixes = Array.from({ length: 7 }, (_, i) => fix(`FIX-c${i}`, 'resolved', `2026-02-0${i + 1}`));
    const fixesNode = section(buildNavTree({ ...snapshot, fixes }, [], view), 'fixes');
    expect(fixesNode.children).toHaveLength(5);
  });

  it('breaks closed-fix ties by creation date and then id', () => {
    const fixes = [fix('FIX-a', 'resolved', '2026-02-01', '2026-01-01'), fix('FIX-b', 'resolved', '2026-02-01', '2026-01-02'), fix('FIX-c', 'resolved', '2026-02-01', '2026-01-02')];
    expect(ids(section(buildNavTree({ ...snapshot, fixes }, [], view), 'fixes').children)).toEqual(['fix:FIX-c', 'fix:FIX-b', 'fix:FIX-a']);
  });

  it('flags containsSelection for ancestors of the opened thread and selected for an opened channel', () => {
    const threads = [thread({ id: 't', channelId: 'spec:s1', link: cycleLink('s1', 'cycle-01') })];
    const withThread = buildNavTree(snapshot, threads, { channelId: 'spec:s1', threadId: 't' });
    const specs = section(withThread, 'specs');
    const s1 = specs.children[0]!;
    expect([specs.containsSelection, s1.containsSelection, s1.children[1]!.containsSelection, s1.children[0]!.containsSelection]).toEqual([true, true, true, false]);
    expect(s1.selected).toBe(false);
    expect(s1.children[1]!.threads[0]!.selected).toBe(true);
    const channelOnly = buildNavTree(snapshot, threads, { channelId: 'spec:s1', threadId: null });
    expect(section(channelOnly, 'specs').children[0]!.selected).toBe(true);
    expect(section(channelOnly, 'channels').containsSelection).toBe(false);
  });

  it('flags needsAttention in every ancestor of a waiting-approval thread', () => {
    const threads = [thread({ id: 'w', status: 'waiting-approval', channelId: 'spec:s1', link: cycleLink('s1', 'cycle-01') }), thread({ id: 'r', status: 'running' })];
    const tree = buildNavTree(snapshot, threads, view);
    const s1 = section(tree, 'specs').children[0]!;
    expect(section(tree, 'specs').needsAttention).toBe(true);
    expect(s1.needsAttention).toBe(true);
    expect(s1.children[1]!.needsAttention).toBe(true);
    expect(section(tree, 'channels').needsAttention).toBe(false);
    expect(section(tree, 'active').needsAttention).toBe(true);
  });

  it('lists active threads by attention rank and keeps them also in the tree', () => {
    const threads = [thread({ id: 'q', status: 'queued', lastActivity: '2026-03-01' }), thread({ id: 'r', status: 'running', lastActivity: '2026-02-01' }), thread({ id: 'w', status: 'waiting-approval' }), thread({ id: 'i' })];
    const tree = buildNavTree(snapshot, threads, view);
    expect(section(tree, 'active').threads.map((t) => t.id)).toEqual(['w', 'r', 'q']);
    expect(section(tree, 'active').threadCount).toBe(3);
    expect(section(tree, 'channels').threadCount).toBe(4);
  });

  it('sorts threads by recency and tolerates a null snapshot', () => {
    const threads = [thread({ id: 'old', lastActivity: '2026-01-01' }), thread({ id: 'new', lastActivity: '2026-02-01' })];
    const tree = buildNavTree(null, threads, view);
    expect(section(tree, 'channels').children[0]!.threads.map((t) => t.id)).toEqual(['new', 'old']);
    expect(section(tree, 'specs').children).toEqual([]);
  });
});
