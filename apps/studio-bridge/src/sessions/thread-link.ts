import {
  MAX_LINK_TARGETS,
  specIdOfChannel,
  ThreadLinkRef,
  ThreadLinkTarget,
  type CycleSummary,
  type ThreadLink,
  type ThreadLinkEntry,
  type WorkspaceSnapshot,
} from '@sdd-studio/protocol';
import { OPEN_FIX } from '../gate/judge';

const NONE: ThreadLinkTarget = { kind: 'none' };

const cycleNumber = (cycle: CycleSummary): number => Number(cycle.cycle.slice('cycle-'.length));
const isWellFormed = (target: ThreadLinkTarget): boolean => ThreadLinkTarget.safeParse(target).success;
const openFixes = (snapshot: WorkspaceSnapshot) => snapshot.fixes.filter((fix) => OPEN_FIX.has(fix.status));

export type StoredLinkEntry = ThreadLinkEntry & { dismissed?: true };
export const MAX_STORED_LINK_ENTRIES = 64;

type RefLike = ThreadLinkRef | ThreadLinkEntry;

export function linkTargetExists(snapshot: WorkspaceSnapshot, target: ThreadLinkTarget | ThreadLinkRef): boolean {
  if (target.kind === 'spec') return ThreadLinkRef.safeParse(target).success && snapshot.specs.some((spec) => spec.id === target.specId);
  if (!isWellFormed(target)) return false;
  if (target.kind === 'cycle') return snapshot.cycles.some((c) => c.specId === target.specId && c.cycle === target.cycle);
  if (target.kind === 'fix') return snapshot.fixes.some((fix) => fix.id === target.fixId);
  return true;
}

export function sameRef(a: RefLike, b: RefLike): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'spec' && b.kind === 'spec') return a.specId === b.specId;
  if (a.kind === 'cycle' && b.kind === 'cycle') return a.specId === b.specId && a.cycle === b.cycle;
  return a.kind === 'fix' && b.kind === 'fix' && a.fixId === b.fixId;
}

export const refOf = (entry: ThreadLinkEntry): ThreadLinkRef => {
  const { origin: _origin, ...ref } = entry;
  return ref;
};

export const activeEntries = (entries: StoredLinkEntry[]): ThreadLinkEntry[] =>
  entries.filter((entry) => !entry.dismissed).map(({ dismissed: _dismissed, ...entry }) => entry);

const isActive = (entry: StoredLinkEntry): boolean => !entry.dismissed;

function boundStored(entries: StoredLinkEntry[]): StoredLinkEntry[] {
  const bounded = [...entries];
  while (bounded.length > MAX_STORED_LINK_ENTRIES) {
    const index = [bounded.findIndex((e) => e.dismissed), bounded.findIndex((e) => e.origin === 'detected'), 0].find((i) => i >= 0)!;
    bounded.splice(index, 1);
  }
  return bounded;
}

export function addManual(entries: StoredLinkEntry[], ref: ThreadLinkRef): StoredLinkEntry[] {
  const kept = entries.filter((entry) => !sameRef(entry, ref));
  return boundStored([...kept, { ...ref, origin: 'manual' }]);
}

export function removeRef(entries: StoredLinkEntry[], ref: ThreadLinkRef): StoredLinkEntry[] {
  if (!entries.some((entry) => isActive(entry) && sameRef(entry, ref))) return entries;
  return entries.map((entry) => (isActive(entry) && sameRef(entry, ref) ? { ...ref, origin: 'detected', dismissed: true } : entry));
}

function specOfRef(snapshot: WorkspaceSnapshot, ref: ThreadLinkRef): string | null {
  if (ref.kind === 'fix') return snapshot.fixes.find((fix) => fix.id === ref.fixId)?.specId ?? null;
  return ref.specId;
}

export function detectRef(entries: StoredLinkEntry[], ref: ThreadLinkRef, snapshot: WorkspaceSnapshot): StoredLinkEntry[] {
  if (!linkTargetExists(snapshot, ref)) return entries;
  if (entries.some((entry) => sameRef(entry, ref))) return entries;
  const specId = specOfRef(snapshot, ref);
  const active = entries.filter(isActive);
  if (ref.kind === 'spec') {
    const covered = active.some((entry) => entry.kind !== 'spec' && specOfRef(snapshot, entry) === ref.specId);
    if (covered) return entries;
  }
  if (active.length >= MAX_LINK_TARGETS) return entries;
  const collapsed: StoredLinkEntry[] =
    ref.kind === 'spec' || specId === null
      ? entries
      : entries.map((entry) =>
          isActive(entry) && entry.kind === 'spec' && entry.specId === specId && entry.origin === 'detected'
            ? { ...entry, dismissed: true as const }
            : entry,
        );
  return boundStored([...collapsed, { ...ref, origin: 'detected' }]);
}

const SPEC_PATH = /^sdd\/specs\/([^/]+)\/(.*)$/;
const CYCLE_PATH = /^cycles\/(cycle-\d{2})(?:\/|$)/;
const FIX_FILE = /(?:^|\/)(fix-[^/]+)\.md$/;

function fixRefOfFile(snapshot: WorkspaceSnapshot, path: string): ThreadLinkRef | null {
  const name = FIX_FILE.exec(path)?.[1]?.toLowerCase();
  if (!name) return null;
  const fix = snapshot.fixes.find((candidate) => candidate.id.toLowerCase() === name);
  return fix ? { kind: 'fix', fixId: fix.id } : null;
}

export function detectRefs(snapshot: WorkspaceSnapshot, rawPath: string): ThreadLinkRef[] {
  const path = rawPath.replace(/\\/g, '/').replace(/^\.\//, '');
  const specMatch = SPEC_PATH.exec(path);
  const candidates: Array<ThreadLinkRef | null> = [];
  if (specMatch) {
    const [, specId = '', rest = ''] = specMatch;
    const cycle = CYCLE_PATH.exec(rest)?.[1];
    if (cycle) candidates.push({ kind: 'cycle', specId, cycle });
    else candidates.push(rest.startsWith('fixes/') ? fixRefOfFile(snapshot, rest) : null, { kind: 'spec', specId });
  } else if (path.startsWith('sdd/fixes/')) {
    candidates.push(fixRefOfFile(snapshot, path));
  }
  const [first] = candidates.filter((ref): ref is ThreadLinkRef => ref !== null && linkTargetExists(snapshot, ref));
  return first ? [first] : [];
}

export function legacyTargetOf(
  entries: StoredLinkEntry[],
  fallbackSource: ThreadLink['source'] = 'auto',
): { target: ThreadLinkTarget; source: ThreadLink['source'] } {
  const latest = entries.filter(isActive).reverse().find((entry) => entry.kind !== 'spec');
  if (!latest) return { target: NONE, source: fallbackSource };
  const source = latest.origin === 'manual' ? 'manual' : 'auto';
  if (latest.kind === 'cycle') return { target: { kind: 'cycle', specId: latest.specId, cycle: latest.cycle }, source };
  return { target: { kind: 'fix', fixId: latest.fixId }, source };
}

function onlyOpenFix(fixes: Array<{ id: string }>): ThreadLinkTarget {
  const [only] = fixes;
  return fixes.length === 1 && only ? { kind: 'fix', fixId: only.id } : NONE;
}

function autoTarget(channelId: string, snapshot: WorkspaceSnapshot): ThreadLinkTarget {
  const specId = specIdOfChannel(channelId);
  if (specId !== null) {
    const [latest] = snapshot.cycles
      .filter((c) => c.specId === specId && c.status === 'in-progress')
      .sort((a, b) => cycleNumber(b) - cycleNumber(a));
    if (latest) return { kind: 'cycle', specId, cycle: latest.cycle };
    return onlyOpenFix(openFixes(snapshot).filter((fix) => fix.specId === specId));
  }
  return channelId === 'fixes' ? onlyOpenFix(openFixes(snapshot)) : NONE;
}

export function assignLink(args: { channelId: string; snapshot: WorkspaceSnapshot; explicit?: ThreadLinkTarget }): ThreadLink | null {
  if (args.explicit) {
    return linkTargetExists(args.snapshot, args.explicit) ? { target: args.explicit, source: 'manual' } : null;
  }
  const target = autoTarget(args.channelId, args.snapshot);
  return { target: isWellFormed(target) ? target : NONE, source: 'auto' };
}
