import type { CycleSummary, FixSummary, SpecSummary } from '@sdd-studio/protocol';
import { currentCycleOf, cyclesOf, isFixOpen, isSpecActive, isSpecClosed, normalizeSeverity, severityRank } from './sdd-status';

const spec = (id: string, status: string): SpecSummary => ({ id, title: id, status, folder: id, module: null, app: null, dependsOn: [] });
const cycle = (specId: string, n: number, status: string): CycleSummary => ({ specId, cycle: `cycle-0${n}`, status, flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0 });
const fix = (status: string): FixSummary => ({ id: 'FIX-001', status }) as FixSummary;

describe('sdd status rules', () => {
  it('picks the in-progress cycle, else the highest number', () => {
    expect(currentCycleOf([cycle('a', 1, 'in-progress'), cycle('a', 2, 'completed')], 'a')?.cycle).toBe('cycle-01');
    expect(currentCycleOf([cycle('a', 1, 'completed'), cycle('a', 2, 'completed')], 'a')?.cycle).toBe('cycle-02');
    expect(currentCycleOf([], 'a')).toBeNull();
  });

  it('orders the cycles of one spec by number', () => {
    expect(cyclesOf([cycle('a', 2, 'completed'), cycle('b', 1, 'completed'), cycle('a', 1, 'completed')], 'a').map((c) => c.cycle)).toEqual(['cycle-01', 'cycle-02']);
  });

  it('treats a spec as active by its own status or by an in-progress cycle, and completed as closed', () => {
    expect(isSpecActive(spec('a', 'in-progress'), [])).toBe(true);
    expect(isSpecActive(spec('a', 'draft'), [cycle('a', 1, 'in-progress')])).toBe(true);
    expect(isSpecActive(spec('a', 'planned'), [])).toBe(false);
    expect(isSpecActive(spec('a', 'completed'), [cycle('a', 1, 'completed')])).toBe(false);
    expect(isSpecClosed(spec('a', 'completed'))).toBe(true);
    expect(isSpecClosed(spec('a', 'draft'))).toBe(false);
  });

  it('treats pending and in-progress fixes as open', () => {
    expect(isFixOpen(fix('pending'))).toBe(true);
    expect(isFixOpen(fix('in-progress'))).toBe(true);
    expect(isFixOpen(fix('validated'))).toBe(false);
  });

  it('ranks severities across languages and sends unknown ones last', () => {
    expect(normalizeSeverity('crítica')).toBe('critical');
    expect(severityRank('Alta')).toBeLessThan(severityRank('media'));
    expect(severityRank('rara')).toBe(severityRank(null));
  });
});
