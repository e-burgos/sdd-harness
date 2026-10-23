import type { CycleSummary, FixSummary, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import { assignLink, linkTargetExists } from './thread-link';

const cycle = (specId: string, n: number, status: string): CycleSummary => ({
  specId, cycle: `cycle-${String(n).padStart(2, '0')}`, status, flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0,
});
const fix = (id: string, status: string, specId: string | null = null): FixSummary => ({
  id, title: id, status, severity: null, specId, createdAt: null, closedAt: null,
});
const snapshotOf = (cycles: CycleSummary[], fixes: FixSummary[]): WorkspaceSnapshot =>
  ({ project: 'p', profile: 'team', kitVersion: null, specs: [], cycles, fixes, agents: [], skills: [], gateMode: 'block', pricing: null, stale: [] });

describe('assignLink', () => {
  it('links a spec channel to its in-progress cycle, the highest one when several', () => {
    const snapshot = snapshotOf([cycle('spec-a', 1, 'in-progress'), cycle('spec-a', 3, 'in-progress'), cycle('spec-a', 4, 'completed'), cycle('spec-b', 9, 'in-progress')], []);
    expect(assignLink({ channelId: 'spec:spec-a', snapshot })).toEqual({
      target: { kind: 'cycle', specId: 'spec-a', cycle: 'cycle-03' }, source: 'auto',
    });
  });

  it('falls back to the single open fix of the spec, and to none when there are zero or several', () => {
    const closed = [cycle('spec-a', 1, 'completed')];
    expect(assignLink({ channelId: 'spec:spec-a', snapshot: snapshotOf(closed, [fix('FIX-1', 'pending', 'spec-a'), fix('FIX-2', 'closed', 'spec-a')]) })?.target)
      .toEqual({ kind: 'fix', fixId: 'FIX-1' });
    expect(assignLink({ channelId: 'spec:spec-a', snapshot: snapshotOf(closed, []) })?.target).toEqual({ kind: 'none' });
    expect(assignLink({ channelId: 'spec:spec-a', snapshot: snapshotOf(closed, [fix('FIX-1', 'pending', 'spec-a'), fix('FIX-2', 'in-progress', 'spec-a')]) })?.target)
      .toEqual({ kind: 'none' });
  });

  it('prefers the cycle over an open fix in a spec channel', () => {
    const snapshot = snapshotOf([cycle('spec-a', 1, 'in-progress')], [fix('FIX-1', 'pending', 'spec-a')]);
    expect(assignLink({ channelId: 'spec:spec-a', snapshot })?.target).toMatchObject({ kind: 'cycle' });
  });

  it('links the fixes channel to the only open fix', () => {
    expect(assignLink({ channelId: 'fixes', snapshot: snapshotOf([], [fix('FIX-1', 'in-progress'), fix('FIX-2', 'closed')]) })?.target)
      .toEqual({ kind: 'fix', fixId: 'FIX-1' });
    expect(assignLink({ channelId: 'fixes', snapshot: snapshotOf([], [fix('FIX-1', 'pending'), fix('FIX-2', 'pending')]) })?.target)
      .toEqual({ kind: 'none' });
  });

  it('leaves general and dm channels without a link', () => {
    const snapshot = snapshotOf([cycle('spec-a', 1, 'in-progress')], [fix('FIX-1', 'pending')]);
    for (const channelId of ['general', 'dm:sdd-planner']) expect(assignLink({ channelId, snapshot })).toEqual({ target: { kind: 'none' }, source: 'auto' });
  });

  it('accepts an explicit existing target as manual, including closed cycles and none', () => {
    const snapshot = snapshotOf([cycle('spec-a', 1, 'completed')], [fix('FIX-1', 'closed')]);
    expect(assignLink({ channelId: 'general', snapshot, explicit: { kind: 'cycle', specId: 'spec-a', cycle: 'cycle-01' } }))
      .toEqual({ target: { kind: 'cycle', specId: 'spec-a', cycle: 'cycle-01' }, source: 'manual' });
    expect(assignLink({ channelId: 'general', snapshot, explicit: { kind: 'fix', fixId: 'FIX-1' } })?.source).toBe('manual');
    expect(assignLink({ channelId: 'general', snapshot, explicit: { kind: 'none' } })).toEqual({ target: { kind: 'none' }, source: 'manual' });
  });

  it('returns null for an explicit target that does not exist', () => {
    const snapshot = snapshotOf([cycle('spec-a', 1, 'completed')], []);
    expect(assignLink({ channelId: 'general', snapshot, explicit: { kind: 'fix', fixId: 'FIX-9' } })).toBeNull();
    expect(assignLink({ channelId: 'general', snapshot, explicit: { kind: 'cycle', specId: 'spec-a', cycle: 'cycle-02' } })).toBeNull();
  });

  it('never auto-links a fix whose id the protocol would reject', () => {
    expect(assignLink({ channelId: 'fixes', snapshot: snapshotOf([], [fix('hotfix 1', 'pending')]) })?.target).toEqual({ kind: 'none' });
  });
});

describe('linkTargetExists', () => {
  it('rejects malformed targets', () => {
    expect(linkTargetExists(snapshotOf([], [fix('nope', 'pending')]), { kind: 'fix', fixId: 'nope' })).toBe(false);
  });
});
