import type { CycleSummary, FixSummary, SpecSummary, TaskSummary, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { CLOSED_FIX_STATUSES } from '@/lib/sdd-status';

export interface StatusCount {
  status: string;
  count: number;
}

export interface DashboardStats {
  specsTotal: number;
  specsByStatus: StatusCount[];
  cyclesTotal: number;
  cyclesInProgress: number;
  tasksTotal: number;
  tasksDone: number;
  fixesTotal: number;
  fixesOpen: number;
  fixesByStatus: StatusCount[];
}

export interface PlanningCycle {
  cycle: CycleSummary;
  tasks: TaskSummary[];
  points: number;
}

export interface PlanningSpec {
  spec: SpecSummary | null;
  specId: string;
  cycles: PlanningCycle[];
  tasksTotal: number;
  tasksDone: number;
  points: number;
}

const IN_PROGRESS = 'in-progress';

export function countByStatus(items: readonly { status: string }[]): StatusCount[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  return [...counts.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
}

export function dashboardStats(snapshot: Pick<WorkspaceSnapshot, 'specs' | 'cycles' | 'fixes'>): DashboardStats {
  const { specs, cycles, fixes } = snapshot;
  return {
    specsTotal: specs.length,
    specsByStatus: countByStatus(specs),
    cyclesTotal: cycles.length,
    cyclesInProgress: cycles.filter((cycle) => cycle.status === IN_PROGRESS).length,
    tasksTotal: cycles.reduce((sum, cycle) => sum + cycle.tasksTotal, 0),
    tasksDone: cycles.reduce((sum, cycle) => sum + cycle.tasksDone, 0),
    fixesTotal: fixes.length,
    fixesOpen: fixes.filter((fix: FixSummary) => !CLOSED_FIX_STATUSES.has(fix.status)).length,
    fixesByStatus: countByStatus(fixes),
  };
}

const pointsOf = (tasks: readonly TaskSummary[]): number => tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);

export function planningSpecs(snapshot: Pick<WorkspaceSnapshot, 'specs' | 'cycles'>): PlanningSpec[] {
  const groups = new Map<string, PlanningSpec>();
  for (const spec of snapshot.specs) groups.set(spec.id, { spec, specId: spec.id, cycles: [], tasksTotal: 0, tasksDone: 0, points: 0 });
  for (const cycle of snapshot.cycles) {
    const group = groups.get(cycle.specId) ?? { spec: null, specId: cycle.specId, cycles: [], tasksTotal: 0, tasksDone: 0, points: 0 };
    const points = pointsOf(cycle.tasks);
    group.cycles.push({ cycle, tasks: cycle.tasks, points });
    group.tasksTotal += cycle.tasksTotal;
    group.tasksDone += cycle.tasksDone;
    group.points += points;
    groups.set(cycle.specId, group);
  }
  return [...groups.values()].filter((group) => group.cycles.length > 0).map((group) => ({ ...group, cycles: [...group.cycles].sort((a, b) => a.cycle.cycle.localeCompare(b.cycle.cycle)) }));
}

export const percentOf = (done: number, total: number): number => (total <= 0 ? 0 : Math.round((done / total) * 100));
