import { MAX_LINK_TARGETS, type CycleSummary, type FixSummary, type SpecSummary, type ThreadLinkRef, type WorkspaceSnapshot } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import {
  MAX_STORED_LINK_ENTRIES,
  activeEntries,
  addManual,
  assignLink,
  detectRef,
  detectRefs,
  legacyTargetOf,
  linkTargetExists,
  removeRef,
  type StoredLinkEntry,
} from './thread-link';

const cycle = (specId: string, n: number, status: string): CycleSummary => ({
  specId, cycle: `cycle-${String(n).padStart(2, '0')}`, status, flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0,
});
const fix = (id: string, status: string, specId: string | null = null): FixSummary => ({
  id, title: id, status, severity: null, specId, createdAt: null, closedAt: null,
});
const spec = (id: string): SpecSummary => ({ id, title: id, status: 'in-progress', folder: id, module: null, app: null, dependsOn: [] });
const snapshotOf = (cycles: CycleSummary[], fixes: FixSummary[], specs: SpecSummary[] = []): WorkspaceSnapshot =>
  ({ project: 'p', profile: 'team', kitVersion: null, specs, cycles, fixes, agents: [], skills: [], gateMode: 'block', pricing: null, stale: [] });

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

const specRef = (specId: string): ThreadLinkRef => ({ kind: 'spec', specId });
const cycleRef = (specId: string, cycle = 'cycle-01'): ThreadLinkRef => ({ kind: 'cycle', specId, cycle });
const fixRef = (fixId: string): ThreadLinkRef => ({ kind: 'fix', fixId });
const rich = snapshotOf(
  [cycle('spec-a', 1, 'in-progress'), cycle('spec-b', 1, 'in-progress')],
  [fix('FIX-a-001', 'pending', 'spec-a'), fix('FIX-007', 'pending')],
  [spec('spec-a'), spec('spec-b')],
);

describe('linkTargetExists with spec references', () => {
  it('checks the spec against the snapshot', () => {
    expect(linkTargetExists(rich, specRef('spec-a'))).toBe(true);
    expect(linkTargetExists(rich, specRef('spec-z'))).toBe(false);
    expect(linkTargetExists(rich, specRef('bad id'))).toBe(false);
  });
});

describe('addManual', () => {
  it('appends a manual entry and moves an existing one to the end', () => {
    const detected: StoredLinkEntry[] = [{ ...cycleRef('spec-a'), origin: 'detected' } as StoredLinkEntry, { ...fixRef('FIX-007'), origin: 'detected' } as StoredLinkEntry];
    const result = addManual(detected, cycleRef('spec-a'));
    expect(result).toEqual([{ ...fixRef('FIX-007'), origin: 'detected' }, { ...cycleRef('spec-a'), origin: 'manual' }]);
  });

  it('revives a dismissed entry as manual', () => {
    const dismissed: StoredLinkEntry[] = [{ ...fixRef('FIX-007'), origin: 'detected', dismissed: true } as StoredLinkEntry];
    expect(addManual(dismissed, fixRef('FIX-007'))).toEqual([{ ...fixRef('FIX-007'), origin: 'manual' }]);
  });

  it('is idempotent and never mutates its input', () => {
    const input: StoredLinkEntry[] = [];
    const once = addManual(input, specRef('spec-a'));
    expect(input).toEqual([]);
    expect(addManual(once, specRef('spec-a'))).toEqual(once);
  });

  it('bounds the persisted list dropping dismissed entries first', () => {
    const entries: StoredLinkEntry[] = Array.from({ length: MAX_STORED_LINK_ENTRIES }, (_, i) => ({
      ...fixRef(`FIX-${i}`), origin: 'detected', ...(i === 3 ? { dismissed: true as const } : {}),
    }) as StoredLinkEntry);
    const result = addManual(entries, specRef('spec-a'));
    expect(result).toHaveLength(MAX_STORED_LINK_ENTRIES);
    expect(result.some((e) => e.kind === 'fix' && e.fixId === 'FIX-3')).toBe(false);
    expect(result.at(-1)).toEqual({ ...specRef('spec-a'), origin: 'manual' });
  });
});

describe('removeRef', () => {
  it('turns an active entry, manual included, into a persistent dismissal', () => {
    const entries = addManual([], cycleRef('spec-a'));
    const result = removeRef(entries, cycleRef('spec-a'));
    expect(result).toEqual([{ ...cycleRef('spec-a'), origin: 'detected', dismissed: true }]);
    expect(activeEntries(result)).toEqual([]);
  });

  it('is a no-op for a missing or already dismissed entry', () => {
    const entries: StoredLinkEntry[] = [{ ...cycleRef('spec-a'), origin: 'detected', dismissed: true } as StoredLinkEntry];
    expect(removeRef(entries, cycleRef('spec-a'))).toBe(entries);
    expect(removeRef(entries, fixRef('FIX-007'))).toBe(entries);
  });
});

describe('detectRef', () => {
  it('adds a detected entry for an existing target', () => {
    expect(detectRef([], cycleRef('spec-a'), rich)).toEqual([{ ...cycleRef('spec-a'), origin: 'detected' }]);
  });

  it('ignores a target that does not exist in the snapshot', () => {
    expect(detectRef([], cycleRef('spec-a', 'cycle-09'), rich)).toEqual([]);
    expect(detectRef([], fixRef('FIX-404'), rich)).toEqual([]);
  });

  it('does not bring back a dismissed entry', () => {
    const dismissed = removeRef(addManual([], cycleRef('spec-a')), cycleRef('spec-a'));
    expect(detectRef(dismissed, cycleRef('spec-a'), rich)).toBe(dismissed);
  });

  it('does not replace a manual entry nor duplicate an active one', () => {
    const manual = addManual([], cycleRef('spec-a'));
    expect(detectRef(manual, cycleRef('spec-a'), rich)).toBe(manual);
  });

  it('skips a spec already covered by an active cycle or fix of that spec', () => {
    const withCycle = detectRef([], cycleRef('spec-a'), rich);
    expect(detectRef(withCycle, specRef('spec-a'), rich)).toBe(withCycle);
    const withFix = detectRef([], fixRef('FIX-a-001'), rich);
    expect(detectRef(withFix, specRef('spec-a'), rich)).toBe(withFix);
    expect(detectRef(withCycle, specRef('spec-b'), rich)).toHaveLength(2);
  });

  it('collapses a detected spec when one of its cycles or fixes arrives', () => {
    const withSpec = detectRef([], specRef('spec-a'), rich);
    const afterCycle = detectRef(withSpec, cycleRef('spec-a'), rich);
    expect(activeEntries(afterCycle)).toEqual([{ ...cycleRef('spec-a'), origin: 'detected' }]);
    const afterFix = detectRef(withSpec, fixRef('FIX-a-001'), rich);
    expect(activeEntries(afterFix)).toEqual([{ ...fixRef('FIX-a-001'), origin: 'detected' }]);
    expect(detectRef(afterCycle, specRef('spec-a'), rich)).toBe(afterCycle);
  });

  it('keeps a manual spec entry when a cycle of that spec is detected', () => {
    const manualSpec = addManual([], specRef('spec-a'));
    expect(activeEntries(detectRef(manualSpec, cycleRef('spec-a'), rich))).toHaveLength(2);
  });

  it('stops detecting at the active cap but still accepts manual additions', () => {
    const fixes = Array.from({ length: MAX_LINK_TARGETS + 1 }, (_, i) => fix(`FIX-${i}`, 'pending'));
    const snapshot = snapshotOf([], fixes, [spec('spec-a')]);
    let entries: StoredLinkEntry[] = [];
    for (let i = 0; i < MAX_LINK_TARGETS; i += 1) entries = detectRef(entries, fixRef(`FIX-${i}`), snapshot);
    expect(entries).toHaveLength(MAX_LINK_TARGETS);
    expect(detectRef(entries, fixRef(`FIX-${MAX_LINK_TARGETS}`), snapshot)).toBe(entries);
    expect(addManual(entries, fixRef(`FIX-${MAX_LINK_TARGETS}`))).toHaveLength(MAX_LINK_TARGETS + 1);
  });
});

describe('detectRefs', () => {
  it.each([
    ['sdd/specs/spec-a/brief.yaml', [specRef('spec-a')]],
    ['sdd/specs/spec-a/cycles/cycle-01/tasks.json', [cycleRef('spec-a')]],
    ['./sdd/specs/spec-a/cycles/cycle-01/artifacts/x.md', [cycleRef('spec-a')]],
    ['sdd\\specs\\spec-a\\cycles\\cycle-01\\plan.md', [cycleRef('spec-a')]],
    ['sdd/specs/spec-a/fixes/fix-a-001.md', [fixRef('FIX-a-001')]],
    ['sdd/fixes/fix-007.md', [fixRef('FIX-007')]],
  ])('%s', (path, expected) => {
    expect(detectRefs(rich, path)).toEqual(expected);
  });

  it.each([
    'sdd/specs/spec-z/brief.yaml',
    'sdd/specs/spec-a/cycles/cycle-09/tasks.json',
    'sdd/fixes/fix-999.md',
    'sdd/memory/lessons.md',
    'apps/studio/src/a.ts',
    '/abs/elsewhere/sdd/specs/spec-a/brief.yaml',
  ])('finds nothing for %s', (path) => {
    expect(detectRefs(rich, path)).toEqual([]);
  });

  it('falls back to the spec for an unknown fix file inside a spec', () => {
    expect(detectRefs(rich, 'sdd/specs/spec-a/fixes/fix-unknown.md')).toEqual([specRef('spec-a')]);
  });
});

describe('legacyTargetOf', () => {
  it('uses the latest active non-spec entry and its origin', () => {
    let entries = detectRef([], cycleRef('spec-a'), rich);
    entries = addManual(entries, fixRef('FIX-007'));
    entries = detectRef(entries, specRef('spec-b'), rich);
    expect(legacyTargetOf(entries)).toEqual({ target: { kind: 'fix', fixId: 'FIX-007' }, source: 'manual' });
    expect(legacyTargetOf(removeRef(entries, fixRef('FIX-007')))).toEqual({
      target: { kind: 'cycle', specId: 'spec-a', cycle: 'cycle-01' }, source: 'auto',
    });
  });

  it('never returns a spec: only specs or nothing active gives none with the fallback source', () => {
    expect(legacyTargetOf(detectRef([], specRef('spec-a'), rich), 'legacy')).toEqual({ target: { kind: 'none' }, source: 'legacy' });
    expect(legacyTargetOf([])).toEqual({ target: { kind: 'none' }, source: 'auto' });
  });
});
