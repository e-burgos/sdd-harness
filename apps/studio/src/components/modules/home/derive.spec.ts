import type { CycleSummary, SpecSummary, ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { emptyThread, type ThreadState } from '@/lib/store/timeline';
import {
  ACTIVE_WINDOW_MS,
  countBy,
  currentCycleOf,
  homeChannelKind,
  isSpecActive,
  isThreadActive,
  recentEvents,
  needsApproval,
  runningThreads,
  sortFixes,
  specRows,
  visibleConversations,
} from './derive';

const NOW = Date.parse('2026-10-27T12:00:00Z');

const info = (overrides: Partial<ThreadInfo>): ThreadInfo =>
  ({
    id: 't1',
    channelId: 'general',
    title: 'Hilo',
    agent: 'sdd-orchestrator',
    options: {},
    status: 'idle',
    createdAt: '2026-10-01T00:00:00Z',
    lastActivity: '2026-10-01T00:00:00Z',
    link: { source: 'detected', target: { kind: 'none' } },
    pendingCount: 0,
    ...overrides,
  }) as ThreadInfo;

const state = (overrides: Partial<ThreadInfo>, extra: Partial<ThreadState> = {}): ThreadState => ({ ...emptyThread(), info: info(overrides), ...extra });

const spec = (id: string, status: string): SpecSummary => ({ id, title: id, status, folder: id, module: null, app: null, dependsOn: [] });
const cycle = (specId: string, n: number, status: string): CycleSummary => ({ specId, cycle: `cycle-0${n}`, status, flow: 'full', apps: [], tasks: [], tasksTotal: 4, tasksDone: 1 });

describe('home derivations', () => {
  it('classifies channels', () => {
    expect(homeChannelKind('general')).toBe('general');
    expect(homeChannelKind('fixes')).toBe('fixes');
    expect(homeChannelKind('spec:spec-a')).toBe('specs');
    expect(homeChannelKind('dm:sdd-planner')).toBe('dm');
  });

  it('treats a spec as active when its status or any cycle is in progress', () => {
    expect(isSpecActive(spec('a', 'in-progress'), [])).toBe(true);
    expect(isSpecActive(spec('a', 'draft'), [cycle('a', 1, 'in-progress')])).toBe(true);
    expect(isSpecActive(spec('a', 'completed'), [cycle('a', 1, 'completed')])).toBe(false);
  });

  it('picks the in-progress cycle, else the highest number', () => {
    expect(currentCycleOf([cycle('a', 1, 'in-progress'), cycle('a', 2, 'completed')], 'a')?.cycle).toBe('cycle-01');
    expect(currentCycleOf([cycle('a', 1, 'completed'), cycle('a', 2, 'completed')], 'a')?.cycle).toBe('cycle-02');
    expect(currentCycleOf([], 'a')).toBeNull();
  });

  it('lists active specs first', () => {
    const snapshot = { specs: [spec('closed', 'completed'), spec('live', 'in-progress')], cycles: [] } as unknown as WorkspaceSnapshot;
    expect(specRows(snapshot).map((row) => row.spec.id)).toEqual(['live', 'closed']);
  });

  it('counts by key preserving first appearance', () => {
    expect(countBy(['b', 'a', 'b'], (x) => x)).toEqual([{ key: 'b', count: 2 }, { key: 'a', count: 1 }]);
  });

  it('orders fixes by severity then newest', () => {
    const fix = (id: string, severity: string | null, createdAt: string | null) => ({ id, title: id, status: 'pending', severity, specId: null, createdAt, closedAt: null });
    const sorted = sortFixes([fix('low', 'low', '2026-01-01'), fix('none', null, '2026-03-01'), fix('crit', 'critical', '2026-01-01'), fix('high-new', 'high', '2026-02-01'), fix('high-old', 'high', '2026-01-01')]);
    expect(sorted.map((f) => f.id)).toEqual(['crit', 'high-new', 'high-old', 'low', 'none']);
  });

  it('marks a thread active when busy, with a pending message, awaiting approval or recent', () => {
    expect(isThreadActive(state({ status: 'running' }), NOW)).toBe(true);
    expect(isThreadActive(state({ pendingCount: 2 }), NOW)).toBe(true);
    expect(isThreadActive(state({ status: 'waiting-approval' }), NOW)).toBe(true);
    expect(isThreadActive(state({ lastActivity: new Date(NOW - ACTIVE_WINDOW_MS + 1000).toISOString() }), NOW)).toBe(true);
    expect(isThreadActive(state({ lastActivity: new Date(NOW - ACTIVE_WINDOW_MS - 1000).toISOString() }), NOW)).toBe(false);
  });

  it('treats an unparseable lastActivity as inactive', () => {
    expect(isThreadActive(state({ lastActivity: 'nope' }), NOW)).toBe(false);
  });

  it('detects an unresolved question as needing approval', () => {
    const asking = state({ status: 'idle' }, { synced: true, items: [{ kind: 'question', id: 'q', seq: 1, author: { agent: 'a' }, questions: [], outcome: 'pending' } as never] });
    expect(needsApproval(asking)).toBe(true);
    expect(needsApproval(state({ status: 'idle' }))).toBe(false);
  });

  it('lists running threads and filters conversations', () => {
    const threads = {
      a: state({ id: 'a', status: 'running', lastActivity: '2026-10-27T11:00:00Z' }),
      b: state({ id: 'b', status: 'idle' }),
      c: state({ id: 'c', status: 'queued', lastActivity: '2026-10-27T10:00:00Z' }),
    };
    expect(runningThreads(threads).map((i) => i.id)).toEqual(['a', 'c']);
    expect(visibleConversations(threads, 'active', NOW, null).map((i) => i.id)).toEqual(['a', 'c']);
    expect(visibleConversations(threads, 'active', NOW, 'b').map((i) => i.id)).toContain('b');
    expect(visibleConversations(threads, 'all', NOW, null)).toHaveLength(3);
  });
});

describe('recentEvents', () => {
  const event = (id: string, at?: string) => ({ channelId: 'fixes', botKind: 'fix.created' as const, payload: { fixId: id }, ...(at ? { at } : {}) });
  it('orders dated events newest first, then undated newest first', () => {
    const merged = recentEvents([[event('a', '2026-01-01T00:00:00Z'), event('u1'), event('u2')], [event('b', '2026-02-01T00:00:00Z')]]);
    expect(merged.map((e) => e.payload.fixId)).toEqual(['b', 'a', 'u2', 'u1']);
  });
  it('caps the list', () => {
    expect(recentEvents([[event('1'), event('2'), event('3')]], 2)).toHaveLength(2);
  });
});
