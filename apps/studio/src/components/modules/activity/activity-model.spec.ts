import type { BotEvent } from '@sdd-studio/protocol';
import { emptyThread, type ThreadState } from '@/lib/store/timeline';
import { buildActivity, countByKind, dayKeyOf, filterByKinds, filterByQuery, groupByDay, kindOfBotEvent, toggleKind } from './activity-model';

const bot = (botKind: BotEvent['botKind'], channelId: string, payload: Record<string, unknown>, at?: string): BotEvent => ({ botKind, channelId, payload, ...(at ? { at } : {}) });

const thread = (lastActivity: string): ThreadState => ({
  ...emptyThread(),
  info: {
    id: 't1',
    channelId: 'general',
    title: 'Conversación',
    agent: 'sdd-planner',
    options: { agent: 'sdd-planner', model: 'kit', effort: null, permissionMode: 'default' },
    status: 'idle',
    createdAt: '2026-03-01T00:00:00Z',
    lastActivity,
    link: { target: { kind: 'none' }, source: 'legacy' },
    pendingCount: 0,
  },
  items: [
    { kind: 'approval', id: 'p1', seq: 3, author: { kind: 'main' } as never, tool: 'Bash', summary: '$ ls', decision: 'pending' },
    { kind: 'question', id: 'q1', seq: 5, author: { kind: 'main' } as never, questions: [{ question: '¿Seguimos?', options: [], multiSelect: false }], outcome: 'answered' },
    { kind: 'usage', id: 'usage:6', seq: 6, usage: {} as never },
  ],
});

describe('activity model', () => {
  it('classifies bot events into their origins and drops the rest', () => {
    expect(kindOfBotEvent(bot('task.status', 'spec:s', { to: 'done' }))).toBe('task');
    expect(kindOfBotEvent(bot('task.status', 'spec:s', { to: 'in-progress' }))).toBeNull();
    expect(kindOfBotEvent(bot('cycle.opened', 'spec:s', {}))).toBe('spec');
    expect(kindOfBotEvent(bot('fix.status', 'fixes', {}))).toBe('fix');
    expect(kindOfBotEvent(bot('tools.changed', 'general', {}))).toBe('tools');
  });

  it('merges bot and thread events newest first, undated last in reverse file order', () => {
    const entries = buildActivity(
      {
        'spec:s': [bot('spec.status', 'spec:s', { specId: 's' }), bot('cycle.opened', 'spec:s', { specId: 's' }, '2026-03-02T10:00:00Z')],
        fixes: [bot('fix.created', 'fixes', { fixId: 'F1' }, '2026-03-04T10:00:00Z')],
        general: [bot('tools.changed', 'general', { tool: 'rtk', to: true }, '2026-03-01T10:00:00Z'), bot('spec.created', 'general', {})],
      },
      { t1: thread('2026-03-03T10:00:00Z') },
    );
    expect(entries.map((entry) => entry.id)).toEqual([
      'bot:fixes:0',
      'thread:t1:q1',
      'thread:t1:p1',
      'conversation:t1:ended',
      'bot:spec:s:1',
      'bot:general:0',
      'conversation:t1:started',
      'bot:general:1',
      'bot:spec:s:0',
    ]);
    expect(entries.find((entry) => entry.id === 'thread:t1:p1')).toMatchObject({ approx: true, kind: 'approval', target: { kind: 'thread', threadId: 't1' } });
  });

  it('resolves link targets for specs, fixes and tools', () => {
    const entries = buildActivity(
      { 'spec:s': [bot('cycle.opened', 'spec:s', {}, '2026-03-02T10:00:00Z')], fixes: [bot('fix.created', 'fixes', { fixId: 'F1' }, '2026-03-04T10:00:00Z')], general: [bot('tools.changed', 'general', {}, '2026-03-01T10:00:00Z')] },
      {},
    );
    expect(entries.map((entry) => entry.target)).toEqual([{ kind: 'fix', fixId: 'F1' }, { kind: 'spec', specId: 's' }, { kind: 'tools' }]);
  });

  it('counts, filters by origin and query, and toggles origins in a stable order', () => {
    const entries = buildActivity({ fixes: [bot('fix.created', 'fixes', { fixId: 'F1' }, '2026-03-04T10:00:00Z')], general: [bot('tools.changed', 'general', { tool: 'rtk' }, '2026-03-01T10:00:00Z')] }, { t1: thread('2026-03-03T10:00:00Z') });
    expect(countByKind(entries)).toEqual({ approval: 1, question: 1, task: 0, spec: 0, fix: 1, tools: 1, conversation: 2 });
    expect(filterByKinds(entries, ['fix', 'tools'])).toHaveLength(2);
    expect(filterByKinds(entries, [])).toHaveLength(6);
    expect(filterByQuery(entries, ' SEGUIMOS ', (entry) => (entry.detail.type === 'question' ? entry.detail.question : ''))).toHaveLength(1);
    expect(filterByQuery(entries, 'SEGUIMOS', () => 'Aprobación pendiente')).toHaveLength(0);
    expect(filterByQuery(entries, 'aprobacion', () => 'Aprobación pendiente')).toHaveLength(entries.length);
    expect(toggleKind(['tools'], 'approval')).toEqual(['approval', 'tools']);
    expect(toggleKind(['approval', 'tools'], 'approval')).toEqual(['tools']);
  });

  it('groups consecutive entries by local day and keeps undated apart', () => {
    const entries = buildActivity(
      { fixes: [bot('fix.created', 'fixes', { fixId: 'A' }), bot('fix.created', 'fixes', { fixId: 'B' }, '2026-03-04T12:00:00Z'), bot('fix.created', 'fixes', { fixId: 'C' }, '2026-03-04T13:00:00Z'), bot('fix.created', 'fixes', { fixId: 'D' }, '2026-03-02T12:00:00Z')] },
      {},
    );
    const days = groupByDay(entries);
    expect(days.map((day) => day.entries.length)).toEqual([2, 1, 1]);
    expect(days[0]?.key).toBe(dayKeyOf('2026-03-04T12:00:00Z'));
    expect(days[2]?.key).toBe('undated');
  });

  describe('conversations', () => {
    const withInfo = (patch: Partial<NonNullable<ThreadState['info']>>): Record<string, ThreadState> => {
      const base = thread('2026-03-03T10:00:00Z');
      return { t1: { ...base, items: [], info: { ...base.info!, ...patch } } };
    };

    it('derives a start and an end entry from a finished thread', () => {
      const entries = buildActivity({}, withInfo({}));
      expect(entries.map((entry) => [entry.id, entry.at, entry.approx])).toEqual([
        ['conversation:t1:ended', '2026-03-03T10:00:00Z', false],
        ['conversation:t1:started', '2026-03-01T00:00:00Z', false],
      ]);
      expect(entries[0]).toMatchObject({ kind: 'conversation', target: { kind: 'thread', threadId: 't1' }, detail: { type: 'conversation', phase: 'idle', title: 'Conversación', reference: null } });
    });

    it('reports interrupted and failed endings and nothing while the thread is busy', () => {
      expect(buildActivity({}, withInfo({ status: 'interrupted' }))[0]?.detail).toMatchObject({ phase: 'interrupted' });
      expect(buildActivity({}, withInfo({ status: 'error' }))[0]?.detail).toMatchObject({ phase: 'error' });
      for (const status of ['queued', 'running', 'waiting-approval'] as const) {
        expect(buildActivity({}, withInfo({ status })).map((entry) => entry.id)).toEqual(['conversation:t1:started']);
      }
    });

    it('does not emit an end entry for a thread that never ran', () => {
      expect(buildActivity({}, withInfo({ lastActivity: '2026-03-01T00:00:00Z' })).map((entry) => entry.id)).toEqual(['conversation:t1:started']);
    });

    it('links the entries to the spec or fix the thread is linked to', () => {
      const cycle = buildActivity({}, withInfo({ link: { target: { kind: 'cycle', specId: 'spec-dev-001', cycle: 'cycle-01' }, source: 'auto' } }));
      expect(cycle.every((entry) => entry.target?.kind === 'spec' && entry.target.specId === 'spec-dev-001')).toBe(true);
      expect(cycle[0]?.detail).toMatchObject({ reference: 'spec-dev-001' });
      const fix = buildActivity({}, withInfo({ link: { target: { kind: 'fix', fixId: 'FIX-dev-001' }, source: 'manual' } }));
      expect(fix[0]).toMatchObject({ target: { kind: 'fix', fixId: 'FIX-dev-001' }, detail: { reference: 'FIX-dev-001' } });
    });
  });
});
