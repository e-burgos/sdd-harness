import type { LinkOrigin, ThreadInfo, ThreadLinkEntry, ThreadLinkRef, WorkspaceSnapshot } from '@sdd-studio/protocol';

export function linkEntriesOf(info: Pick<ThreadInfo, 'link'>): ThreadLinkEntry[] {
  const { link } = info;
  if (link.targets) return link.targets;
  const origin: LinkOrigin = link.source === 'manual' ? 'manual' : 'detected';
  const { target } = link;
  if (target.kind === 'cycle') return [{ kind: 'cycle', specId: target.specId, cycle: target.cycle, origin }];
  if (target.kind === 'fix') return [{ kind: 'fix', fixId: target.fixId, origin }];
  return [];
}

export function isLinkEntryAvailable(ref: ThreadLinkRef, snapshot: WorkspaceSnapshot | null): boolean {
  if (!snapshot) return true;
  if (ref.kind === 'spec') return snapshot.specs.some((s) => s.id === ref.specId);
  if (ref.kind === 'cycle') return snapshot.cycles.some((c) => c.specId === ref.specId && c.cycle === ref.cycle);
  return snapshot.fixes.some((f) => f.id === ref.fixId);
}

export function linkRefLabel(ref: ThreadLinkRef): string {
  if (ref.kind === 'spec') return ref.specId;
  if (ref.kind === 'cycle') return `${ref.specId} · ${ref.cycle}`;
  return ref.fixId;
}

export function linkRefKey(ref: ThreadLinkRef): string {
  if (ref.kind === 'spec') return `spec:${ref.specId}`;
  if (ref.kind === 'cycle') return `cycle:${ref.specId}/${ref.cycle}`;
  return `fix:${ref.fixId}`;
}

export function toLinkRef(entry: ThreadLinkEntry): ThreadLinkRef {
  if (entry.kind === 'spec') return { kind: 'spec', specId: entry.specId };
  if (entry.kind === 'cycle') return { kind: 'cycle', specId: entry.specId, cycle: entry.cycle };
  return { kind: 'fix', fixId: entry.fixId };
}
