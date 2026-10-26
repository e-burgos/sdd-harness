import type { ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { isLinkEntryAvailable, linkEntriesOf, linkRefKey, linkRefLabel, toLinkRef } from './link-targets';

const link = (over: Partial<ThreadInfo['link']>): Pick<ThreadInfo, 'link'> => ({ link: { target: { kind: 'none' }, source: 'legacy', ...over } });
const snapshot = {
  specs: [{ id: 's1' }],
  cycles: [{ specId: 's1', cycle: 'cycle-01' }],
  fixes: [{ id: 'FIX-a' }],
} as unknown as WorkspaceSnapshot;

describe('linkEntriesOf', () => {
  it('uses targets when the bridge sends them, even if empty', () => {
    expect(linkEntriesOf(link({ target: { kind: 'fix', fixId: 'FIX-a' }, targets: [] }))).toEqual([]);
    const targets = [{ kind: 'spec' as const, specId: 's1', origin: 'detected' as const }];
    expect(linkEntriesOf(link({ targets }))).toBe(targets);
  });

  it('derives a single entry from an old bridge target', () => {
    expect(linkEntriesOf(link({ target: { kind: 'cycle', specId: 's1', cycle: 'cycle-01' }, source: 'manual' }))).toEqual([
      { kind: 'cycle', specId: 's1', cycle: 'cycle-01', origin: 'manual' },
    ]);
    expect(linkEntriesOf(link({ target: { kind: 'fix', fixId: 'FIX-a' }, source: 'auto' }))).toEqual([{ kind: 'fix', fixId: 'FIX-a', origin: 'detected' }]);
  });

  it('derives nothing from an unlinked old bridge thread', () => {
    expect(linkEntriesOf(link({}))).toEqual([]);
  });
});

describe('link refs', () => {
  it('flags entries that no longer exist in the workspace', () => {
    expect(isLinkEntryAvailable({ kind: 'spec', specId: 's1' }, snapshot)).toBe(true);
    expect(isLinkEntryAvailable({ kind: 'spec', specId: 's9' }, snapshot)).toBe(false);
    expect(isLinkEntryAvailable({ kind: 'cycle', specId: 's1', cycle: 'cycle-02' }, snapshot)).toBe(false);
    expect(isLinkEntryAvailable({ kind: 'fix', fixId: 'FIX-gone' }, snapshot)).toBe(false);
  });

  it('does not claim unavailability before the snapshot is known', () => {
    expect(isLinkEntryAvailable({ kind: 'fix', fixId: 'FIX-a' }, null)).toBe(true);
  });

  it('builds labels, keys and plain refs', () => {
    const entry = { kind: 'cycle' as const, specId: 's1', cycle: 'cycle-01', origin: 'manual' as const };
    expect(linkRefLabel(entry)).toBe('s1 · cycle-01');
    expect(linkRefKey(entry)).toBe('cycle:s1/cycle-01');
    expect(toLinkRef(entry)).toEqual({ kind: 'cycle', specId: 's1', cycle: 'cycle-01' });
  });
});
