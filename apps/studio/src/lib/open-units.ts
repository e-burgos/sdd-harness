import type { FileLeaseSummary, SessionBinding, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { isFixOpen } from './sdd-status';

const IN_PROGRESS = 'in-progress';

export type OpenUnit =
  | { kind: 'cycle'; key: string; specId: string; cycle: string; label: string; flow: string; done: number; total: number }
  | { kind: 'fix'; key: string; fixId: string; label: string; title: string; severity: string | null };

export function openUnitsOf(snapshot: WorkspaceSnapshot | null): OpenUnit[] {
  if (!snapshot) return [];
  const cycles = snapshot.cycles
    .filter((c) => c.status === IN_PROGRESS)
    .map((c): OpenUnit => ({
      kind: 'cycle',
      key: `${c.specId}/${c.cycle}`,
      specId: c.specId,
      cycle: c.cycle,
      label: `${c.specId} ${c.cycle}`,
      flow: c.flow,
      done: c.tasksDone,
      total: c.tasksTotal,
    }));
  const fixes = snapshot.fixes.filter(isFixOpen).map((f): OpenUnit => ({ kind: 'fix', key: f.id, fixId: f.id, label: f.id, title: f.title, severity: f.severity }));
  return [...cycles, ...fixes];
}

const belongsTo = (bound: SessionBinding['unit'], unit: OpenUnit): boolean =>
  unit.kind === 'fix' ? bound.kind === 'fix' && bound.fixId === unit.fixId : bound.kind === 'cycle' && bound.specId === unit.specId && bound.cycle === unit.cycle;

export function sessionsOfUnit(snapshot: WorkspaceSnapshot | null, unit: OpenUnit): SessionBinding[] {
  return (snapshot?.sessions ?? []).filter((s) => belongsTo(s.unit, unit));
}

export function leasesOfUnit(snapshot: WorkspaceSnapshot | null, unit: OpenUnit): FileLeaseSummary[] {
  return (snapshot?.leases ?? []).filter((lease) => lease.unit !== null && belongsTo(lease.unit, unit));
}

export function unboundLeases(snapshot: WorkspaceSnapshot | null): FileLeaseSummary[] {
  return (snapshot?.leases ?? []).filter((lease) => lease.unit === null);
}

const SHORT_ID_LENGTH = 8;

export const shortSessionId = (sessionId: string): string => sessionId.replace(/^studio-/, '').slice(0, SHORT_ID_LENGTH);
