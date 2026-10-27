import type { BotEvent, FixSummary, ThreadInfo } from '@sdd-studio/protocol';
import { activityOfFix, documentOfFix, groupFixesByStatus, matchesFix, normalizeSeverity, shortFixId, threadsOfFix } from './fix-model';

const fix = (over: Partial<FixSummary> & { id: string }): FixSummary => ({ title: over.id, status: 'pending', severity: null, specId: null, createdAt: null, closedAt: null, ...over });

describe('groupFixesByStatus', () => {
  it('orders groups by lifecycle and fixes by severity then newest first', () => {
    const groups = groupFixesByStatus([
      fix({ id: 'a', status: 'validated' }),
      fix({ id: 'b', severity: 'low', createdAt: '2026-01-01T00:00:00Z' }),
      fix({ id: 'c', severity: 'high', createdAt: '2026-01-01T00:00:00Z' }),
      fix({ id: 'd', severity: 'high', createdAt: '2026-02-01T00:00:00Z' }),
      fix({ id: 'e', severity: null }),
      fix({ id: 'f', status: 'in-progress' }),
      fix({ id: 'g', status: 'weird' }),
    ]);
    expect(groups.map((g) => g.status)).toEqual(['in-progress', 'pending', 'validated', 'weird']);
    expect(groups[1].fixes.map((x) => x.id)).toEqual(['d', 'c', 'b', 'e']);
  });
});

describe('severity and ids', () => {
  it('normalizes english and spanish aliases and unknown values', () => {
    expect(normalizeSeverity('Alta')).toBe('high');
    expect(normalizeSeverity('critical')).toBe('critical');
    expect(normalizeSeverity('rara')).toBeNull();
    expect(normalizeSeverity(null)).toBeNull();
  });

  it('shortens ids to their trailing numbers', () => {
    expect(shortFixId('FIX-e-burgos-005-006')).toBe('005-006');
    expect(shortFixId('FIX-001')).toBe('001');
    expect(shortFixId('odd')).toBe('odd');
  });
});

describe('documentOfFix', () => {
  it('builds a viewer document only when the fix has one', () => {
    expect(documentOfFix(fix({ id: 'a' }))).toBeNull();
    expect(documentOfFix(fix({ id: 'a', document: 'sdd/fixes/fix-a.md' }))).toMatchObject({ name: 'fix-a.md', path: 'sdd/fixes/fix-a.md', type: 'fix' });
  });
});

describe('matchesFix', () => {
  it('matches id, title, state label and severity label without accents', () => {
    const target = fix({ id: 'FIX-001', title: 'Pérdida de datos', severity: 'high' });
    const labels = { status: 'Pendiente', severity: 'alta' };
    expect(matchesFix('perdida', target, labels)).toBe(true);
    expect(matchesFix('fix-001', target, labels)).toBe(true);
    expect(matchesFix('pendiente', target, labels)).toBe(true);
    expect(matchesFix('alta', target, labels)).toBe(true);
    expect(matchesFix('zzz', target, labels)).toBe(false);
  });
});

const thread = (id: string, fixId: string, lastActivity: string): ThreadInfo =>
  ({ id, channelId: 'fixes', title: `t-${id}`, agent: 'a', status: 'idle', createdAt: lastActivity, lastActivity, pendingCount: 0, options: {}, link: { source: 'manual', target: { kind: 'fix', fixId } } }) as unknown as ThreadInfo;

describe('threadsOfFix and activityOfFix', () => {
  it('lists only threads linked to the fix, newest first', () => {
    const list = [thread('1', 'FIX-1', '2026-01-01T00:00:00Z'), thread('2', 'FIX-2', '2026-01-02T00:00:00Z'), thread('3', 'FIX-1', '2026-01-03T00:00:00Z')];
    expect(threadsOfFix('FIX-1', list).map((t) => t.id)).toEqual(['3', '1']);
  });

  it('merges events and threads by date with undated events last', () => {
    const events: BotEvent[] = [
      { channelId: 'fixes', botKind: 'fix.created', payload: { fixId: 'FIX-1' } },
      { channelId: 'fixes', botKind: 'fix.status', payload: { fixId: 'FIX-1', from: 'pending', to: 'in-progress' }, at: '2026-01-02T00:00:00Z' },
      { channelId: 'fixes', botKind: 'fix.status', payload: { fixId: 'FIX-2' }, at: '2026-01-02T00:00:00Z' },
    ];
    const items = activityOfFix('FIX-1', events, [thread('1', 'FIX-1', '2026-01-03T00:00:00Z')]);
    expect(items.map((i) => i.kind)).toEqual(['thread', 'event', 'event']);
    expect(items[2]).toMatchObject({ at: null });
  });
});
