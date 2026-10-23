import { specIdOfChannel, ThreadLinkTarget, type CycleSummary, type ThreadLink, type WorkspaceSnapshot } from '@sdd-studio/protocol';
import { OPEN_FIX } from '../gate/judge';

const NONE: ThreadLinkTarget = { kind: 'none' };

const cycleNumber = (cycle: CycleSummary): number => Number(cycle.cycle.slice('cycle-'.length));
const isWellFormed = (target: ThreadLinkTarget): boolean => ThreadLinkTarget.safeParse(target).success;
const openFixes = (snapshot: WorkspaceSnapshot) => snapshot.fixes.filter((fix) => OPEN_FIX.has(fix.status));

export function linkTargetExists(snapshot: WorkspaceSnapshot, target: ThreadLinkTarget): boolean {
  if (!isWellFormed(target)) return false;
  if (target.kind === 'cycle') return snapshot.cycles.some((c) => c.specId === target.specId && c.cycle === target.cycle);
  if (target.kind === 'fix') return snapshot.fixes.some((fix) => fix.id === target.fixId);
  return true;
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
