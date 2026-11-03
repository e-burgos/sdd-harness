import type { CycleSummary, FixSummary, SpecSummary } from '@sdd-studio/protocol';
import { countByStatus, dashboardStats, percentOf, planningSpecs } from './metrics-model';

const spec = (id: string, status: string): SpecSummary => ({ id, title: id, status, folder: `sdd/specs/${id}`, module: null, app: null, dependsOn: [] });
const cycle = (specId: string, n: number, status: string, done: number, total: number): CycleSummary => ({
  specId,
  cycle: `cycle-0${n}`,
  status,
  flow: 'full',
  apps: [],
  tasks: [{ id: 'TASK-001', title: 't', status: 'done', storyPoints: 3 }, { id: 'TASK-002', title: 'u', status: 'pending', storyPoints: null }],
  tasksTotal: total,
  tasksDone: done,
});
const fix = (id: string, status: string): FixSummary => ({ id, title: id, status, severity: null, specId: null, createdAt: null, closedAt: null });

describe('dashboardStats', () => {
  it('counts specs by status, cycles in progress, task progress and open fixes from the snapshot', () => {
    const stats = dashboardStats({
      specs: [spec('a', 'in-progress'), spec('b', 'completed'), spec('c', 'in-progress')],
      cycles: [cycle('a', 1, 'in-progress', 1, 4), cycle('b', 1, 'completed', 2, 2)],
      fixes: [fix('F1', 'pending'), fix('F2', 'validated'), fix('F3', 'absorbed')],
    });
    expect(stats.specsByStatus).toEqual([{ status: 'in-progress', count: 2 }, { status: 'completed', count: 1 }]);
    expect(stats).toMatchObject({ specsTotal: 3, cyclesTotal: 2, cyclesInProgress: 1, tasksTotal: 6, tasksDone: 3, fixesTotal: 3, fixesOpen: 1 });
  });

  it('is all zeros for an empty workspace', () => {
    expect(dashboardStats({ specs: [], cycles: [], fixes: [] })).toMatchObject({ specsTotal: 0, tasksTotal: 0, fixesOpen: 0, specsByStatus: [] });
  });
});

describe('planningSpecs', () => {
  it('groups cycles under their spec, sums progress and points and keeps cycles of unregistered specs', () => {
    const groups = planningSpecs({ specs: [spec('a', 'in-progress'), spec('empty', 'draft')], cycles: [cycle('a', 2, 'in-progress', 1, 2), cycle('a', 1, 'completed', 2, 2), cycle('ghost', 1, 'completed', 1, 1)] });
    expect(groups.map((g) => g.specId)).toEqual(['a', 'ghost']);
    expect(groups[0]).toMatchObject({ tasksTotal: 4, tasksDone: 3, points: 6 });
    expect(groups[0]?.cycles.map((c) => c.cycle.cycle)).toEqual(['cycle-01', 'cycle-02']);
    expect(groups[1]?.spec).toBeNull();
  });
});

describe('helpers', () => {
  it('percentOf never divides by zero', () => {
    expect(percentOf(1, 0)).toBe(0);
    expect(percentOf(1, 3)).toBe(33);
  });

  it('countByStatus orders by count then name', () => {
    expect(countByStatus([{ status: 'b' }, { status: 'a' }, { status: 'b' }])).toEqual([{ status: 'b', count: 2 }, { status: 'a', count: 1 }]);
  });
});
