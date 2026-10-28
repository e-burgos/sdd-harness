import type { CycleSummary, SpecSummary, ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import {
  activityEventsOf,
  buildSpecGroups,
  currentCycleOf,
  documentGroupsOf,
  expectedPlanDocuments,
  groupKeyOf,
  isSpecActive,
  planItemsOf,
  threadsOfSpec,
} from './specs-model';

const spec = (id: string, status: string, extra: Partial<SpecSummary> = {}): SpecSummary => ({ id, title: id.toUpperCase(), status, folder: `sdd/specs/${id}`, module: null, app: null, dependsOn: [], ...extra });
const cycle = (specId: string, n: number, status: string, extra: Partial<CycleSummary> = {}): CycleSummary => ({ specId, cycle: `cycle-0${n}`, status, flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0, ...extra });

const snapshot = (specs: SpecSummary[], cycles: CycleSummary[]): WorkspaceSnapshot =>
  ({ project: 'p', profile: 'team', kitVersion: null, specs, cycles, fixes: [], agents: [], skills: [], gateMode: 'block', pricing: null, stale: [] }) as WorkspaceSnapshot;

describe('spec rules', () => {
  it('RN-8: current cycle is the in-progress one, else the highest', () => {
    expect(currentCycleOf([cycle('a', 1, 'in-progress'), cycle('a', 2, 'completed')], 'a')?.cycle).toBe('cycle-01');
    expect(currentCycleOf([cycle('a', 1, 'completed'), cycle('a', 2, 'completed')], 'a')?.cycle).toBe('cycle-02');
    expect(currentCycleOf([], 'a')).toBeNull();
  });

  it('RN-5: active by own status or by an in-progress cycle; completed is closed', () => {
    expect(isSpecActive(spec('a', 'planned'), [cycle('a', 1, 'in-progress')])).toBe(true);
    expect(isSpecActive(spec('a', 'planned'), [])).toBe(false);
    expect(groupKeyOf(spec('a', 'completed'), [])).toBe('completed');
    expect(groupKeyOf(spec('a', 'draft'), [])).toBe('planned');
  });

  it('groups by state under each filter and applies the accent-insensitive query', () => {
    const snap = snapshot(
      [spec('act', 'in-progress'), spec('plan', 'draft'), spec('done', 'completed', { title: 'Cobranza', module: 'pagos' })],
      [cycle('act', 1, 'in-progress')],
    );
    expect(buildSpecGroups(snap, 'active', '').map((g) => g.key)).toEqual(['active']);
    expect(buildSpecGroups(snap, 'closed', '').map((g) => g.key)).toEqual(['completed']);
    expect(buildSpecGroups(snap, 'all', '').map((g) => g.key)).toEqual(['active', 'planned', 'completed']);
    expect(buildSpecGroups(snap, 'all', 'COBRANZA').flatMap((g) => g.rows.map((r) => r.spec.id))).toEqual(['done']);
    expect(buildSpecGroups(snap, 'all', 'in-progress').flatMap((g) => g.rows.map((r) => r.spec.id))).toEqual(['act']);
    expect(buildSpecGroups(snap, 'all', 'CYCLE-01').flatMap((g) => g.rows.map((r) => r.spec.id))).toEqual(['act']);
    expect(buildSpecGroups(snap, 'all', 'concluida', (status) => (status === 'completed' ? 'Concluida' : '')).flatMap((g) => g.rows.map((r) => r.spec.id))).toEqual(['done']);
    expect(buildSpecGroups(snap, 'all', 'pagos').flatMap((g) => g.rows.map((r) => r.spec.id))).toEqual(['done']);
  });
});

describe('plan by flow (RN-11)', () => {
  it('maps flow to the expected documents', () => {
    expect(expectedPlanDocuments('lite').names).toEqual(['plan.md']);
    expect(expectedPlanDocuments('full').names).toEqual(['functional.md', 'planner.md', 'architect.md']);
    expect(expectedPlanDocuments('reduced')).toEqual({ names: ['planner.md', 'architect.md'], optional: true });
  });

  it('marks absent documents as pending and old bridges as unknown', () => {
    const s = spec('a', 'in-progress');
    const withDocs = planItemsOf(s, cycle('a', 1, 'in-progress', { documents: ['functional.md', 'tasks.json'] }));
    expect(withDocs.items.map((i) => [i.name, i.state])).toEqual([
      ['functional.md', 'present'],
      ['planner.md', 'pending'],
      ['architect.md', 'pending'],
    ]);
    expect(withDocs.items[0]?.path).toBe('sdd/specs/a/cycles/cycle-01/functional.md');
    expect(planItemsOf(s, cycle('a', 1, 'in-progress')).items.every((i) => i.state === 'unknown')).toBe(true);
  });
});

describe('documents and threads', () => {
  it('groups spec, cycle and linked fix documents', () => {
    const s = spec('a', 'in-progress', { document: 'sdd/specs/a/spec.md' });
    const groups = documentGroupsOf(
      s,
      [cycle('a', 1, 'completed', { documents: ['plan.md', 'artifacts/x.md'] }), cycle('a', 2, 'in-progress')],
      [
        { id: 'FIX-1', title: 't', status: 'done', severity: null, specId: 'a', createdAt: null, closedAt: null, document: 'sdd/specs/a/fixes/f.md' },
        { id: 'FIX-2', title: 't', status: 'done', severity: null, specId: 'b', createdAt: null, closedAt: null, document: 'sdd/specs/b/fixes/g.md' },
      ],
    );
    expect(groups.map((g) => [g.kind, g.paths])).toEqual([
      ['spec', ['sdd/specs/a/spec.md']],
      ['cycle', ['sdd/specs/a/cycles/cycle-01/plan.md', 'sdd/specs/a/cycles/cycle-01/artifacts/x.md']],
      ['fixes', ['sdd/specs/a/fixes/f.md']],
    ]);
  });

  it('lists threads of the spec channel or linked to its cycles without duplicates', () => {
    const base = { options: {}, status: 'idle', createdAt: '', agent: 'sdd-planner', pendingCount: 0 };
    const mk = (id: string, channelId: string, lastActivity: string, targets?: unknown[]) =>
      ({ ...base, id, channelId, title: id, lastActivity, link: { target: { kind: 'none' }, source: 'auto', targets } }) as unknown as ThreadInfo;
    const list = [
      mk('t1', 'spec:a', '2026-01-01'),
      mk('t2', 'general', '2026-01-03', [{ kind: 'cycle', specId: 'a', cycle: 'cycle-01', origin: 'manual' }, { kind: 'spec', specId: 'a', origin: 'manual' }]),
      mk('t3', 'general', '2026-01-02', [{ kind: 'spec', specId: 'b', origin: 'manual' }]),
    ];
    expect(threadsOfSpec(list, 'a').map((i) => i.id)).toEqual(['t2', 't1']);
  });

  it('orders events newest first and undated ones last', () => {
    const events = [{ at: '2026-01-01', n: 1 }, { n: 2 }, { at: '2026-01-02', n: 3 }];
    expect(activityEventsOf(events).map((e) => e.n)).toEqual([3, 1, 2]);
  });
});
