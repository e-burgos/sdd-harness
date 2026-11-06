import type { WorkspaceSnapshot } from '@sdd-studio/protocol';
import { openUnitsOf, sessionsOfUnit, shortSessionId } from './open-units';

const base: WorkspaceSnapshot = {
  project: 'p', profile: 'team', kitVersion: null, gateMode: 'block', pricing: null, stale: [], agents: [], skills: [], specs: [],
  cycles: [
    { specId: 'spec-a', cycle: 'cycle-01', status: 'completed', flow: 'full', apps: [], tasks: [], tasksTotal: 3, tasksDone: 3 },
    { specId: 'spec-a', cycle: 'cycle-02', status: 'in-progress', flow: 'lite', apps: [], tasks: [], tasksTotal: 5, tasksDone: 2 },
    { specId: 'spec-b', cycle: 'cycle-01', status: 'in-progress', flow: 'full', apps: [], tasks: [], tasksTotal: 4, tasksDone: 0 },
  ],
  fixes: [
    { id: 'FIX-1', title: 'one', status: 'pending', severity: 'low', specId: null, createdAt: null, closedAt: null },
    { id: 'FIX-2', title: 'two', status: 'validated', severity: null, specId: null, createdAt: null, closedAt: null },
    { id: 'FIX-3', title: 'three', status: 'in-progress', severity: null, specId: null, createdAt: null, closedAt: null },
  ],
};

const binding = (sessionId: string, unit: NonNullable<WorkspaceSnapshot['sessions']>[number]['unit'], harness = 'claude-code') => ({
  sessionId, unit, harness, source: 'sdd-use', worktree: '/r', boundAt: '2026-11-06T10:00:00Z', updatedAt: '2026-11-06T10:00:00Z',
});

describe('openUnitsOf', () => {
  it('lists every in-progress cycle and every open fix, never just the first', () => {
    expect(openUnitsOf(base).map((u) => u.key)).toEqual(['spec-a/cycle-02', 'spec-b/cycle-01', 'FIX-1', 'FIX-3']);
  });
  it('is empty without a snapshot or without open work', () => {
    expect(openUnitsOf(null)).toEqual([]);
    expect(openUnitsOf({ ...base, cycles: [], fixes: [] })).toEqual([]);
  });
});

describe('sessionsOfUnit', () => {
  const sessions = [
    binding('claude-aaaaaaaaaa', { kind: 'cycle', specId: 'spec-a', cycle: 'cycle-02' }),
    binding('studio-12345678-9999', { kind: 'fix', fixId: 'FIX-1' }, 'studio'),
  ];
  it('matches sessions to their unit', () => {
    const [cycleA, , fixOne] = openUnitsOf(base);
    expect(sessionsOfUnit({ ...base, sessions }, cycleA!).map((s) => s.sessionId)).toEqual(['claude-aaaaaaaaaa']);
    expect(sessionsOfUnit({ ...base, sessions }, fixOne!).map((s) => s.sessionId)).toEqual(['studio-12345678-9999']);
  });
  it('returns nothing when the bridge sends no sessions', () => {
    expect(sessionsOfUnit(base, openUnitsOf(base)[0]!)).toEqual([]);
  });
  it('shortens ids', () => {
    expect(shortSessionId('studio-12345678-9999')).toBe('12345678');
    expect(shortSessionId('claude-aaaaaaaaaa')).toBe('claude-a');
  });
});
