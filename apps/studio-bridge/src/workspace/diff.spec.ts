import type { WorkspaceSnapshot } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import { diffSnapshots } from './diff';

const base: WorkspaceSnapshot = {
  project: 'p', profile: 'team', kitVersion: null, agents: [], gateMode: 'block', pricing: null, stale: [],
  specs: [{ id: 's1', title: 'S1', status: 'in-progress', folder: 'sdd/specs/s1', module: null, app: null, dependsOn: [] }],
  cycles: [{
    specId: 's1', cycle: 'cycle-01', status: 'in-progress', flow: 'full', apps: [], tasksTotal: 1, tasksDone: 0,
    tasks: [{ id: 'T1', title: 'Task 1', status: 'pending', storyPoints: 1 }],
  }],
  fixes: [{ id: 'F1', title: 'Fix 1', status: 'pending', severity: 'low', specId: 's1' }],
};
const clone = (): WorkspaceSnapshot => structuredClone(base);

describe('diffSnapshots', () => {
  it('emits nothing for identical snapshots', () => {
    expect(diffSnapshots(base, clone())).toEqual([]);
  });

  it('reports a new spec and a spec status change', () => {
    const next = clone();
    next.specs[0]!.status = 'completed';
    next.specs.push({ id: 's2', title: 'S2', status: 'draft', folder: 'sdd/specs/s2', module: null, app: null, dependsOn: [] });
    expect(diffSnapshots(base, next)).toEqual([
      { channelId: 'spec:s1', botKind: 'spec.status', payload: { specId: 's1', from: 'in-progress', to: 'completed' } },
      { channelId: 'spec:s2', botKind: 'spec.created', payload: { specId: 's2', title: 'S2', status: 'draft' } },
    ]);
  });

  it('reports cycle opened, cycle status and task status', () => {
    const next = clone();
    next.cycles[0]!.status = 'completed';
    next.cycles[0]!.tasks[0]!.status = 'done';
    next.cycles.push({ ...structuredClone(base.cycles[0]!), cycle: 'cycle-02', status: 'in-progress' });
    expect(diffSnapshots(base, next)).toEqual([
      { channelId: 'spec:s1', botKind: 'cycle.status', payload: { specId: 's1', cycle: 'cycle-01', from: 'in-progress', to: 'completed' } },
      { channelId: 'spec:s1', botKind: 'task.status', payload: { specId: 's1', cycle: 'cycle-01', taskId: 'T1', title: 'Task 1', from: 'pending', to: 'done' } },
      { channelId: 'spec:s1', botKind: 'cycle.opened', payload: { specId: 's1', cycle: 'cycle-02', flow: 'full', status: 'in-progress' } },
    ]);
  });

  it('reports fixes on the fixes channel', () => {
    const next = clone();
    next.fixes[0]!.status = 'resolved';
    next.fixes.push({ id: 'F2', title: 'Fix 2', status: 'pending', severity: 'high', specId: null });
    expect(diffSnapshots(base, next)).toEqual([
      { channelId: 'fixes', botKind: 'fix.status', payload: { fixId: 'F1', from: 'pending', to: 'resolved' } },
      { channelId: 'fixes', botKind: 'fix.created', payload: { fixId: 'F2', title: 'Fix 2', severity: 'high', specId: null } },
    ]);
  });
});
