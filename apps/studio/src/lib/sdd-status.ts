import type { CycleSummary, FixSummary, SpecSummary } from '@sdd-studio/protocol';

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];

const SEVERITY_ALIASES: Record<string, Severity> = {
  critical: 'critical',
  critica: 'critical',
  crítica: 'critical',
  high: 'high',
  alta: 'high',
  medium: 'medium',
  media: 'medium',
  low: 'low',
  baja: 'low',
};

export function normalizeSeverity(severity: string | null): Severity | null {
  return severity === null ? null : (SEVERITY_ALIASES[severity.trim().toLowerCase()] ?? null);
}

export function severityRank(severity: string | null): number {
  const normalized = normalizeSeverity(severity);
  return normalized === null ? SEVERITIES.length : SEVERITIES.indexOf(normalized);
}

export const OPEN_FIX_STATUSES: ReadonlySet<string> = new Set(['pending', 'in-progress']);
export const CLOSED_FIX_STATUSES: ReadonlySet<string> = new Set(['validated', 'absorbed']);

export const isFixOpen = (fix: FixSummary): boolean => OPEN_FIX_STATUSES.has(fix.status);

const IN_PROGRESS = 'in-progress';
const COMPLETED = 'completed';
const cycleNumber = (cycle: string) => Number(cycle.slice(6));

export const cyclesOf = (cycles: readonly CycleSummary[], specId: string): CycleSummary[] =>
  cycles.filter((c) => c.specId === specId).sort((a, b) => cycleNumber(a.cycle) - cycleNumber(b.cycle));

export function currentCycleOf(cycles: readonly CycleSummary[], specId: string): CycleSummary | null {
  const own = cyclesOf(cycles, specId);
  return own.find((c) => c.status === IN_PROGRESS) ?? own.at(-1) ?? null;
}

export const isSpecActive = (spec: SpecSummary, cycles: readonly CycleSummary[]): boolean =>
  spec.status === IN_PROGRESS || cycles.some((c) => c.specId === spec.id && c.status === IN_PROGRESS);

export const isSpecClosed = (spec: SpecSummary): boolean => spec.status === COMPLETED;
