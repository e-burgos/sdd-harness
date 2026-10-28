import { channelForSpec, type CycleSummary, type FixSummary, type SpecSummary, type ThreadInfo, type WorkspaceSnapshot } from '@sdd-studio/protocol';
import type { AgentGeneratedDocument } from '@/lib/agent-documents';
import { linkEntriesOf } from '@/lib/link-targets';
import { matchesQuery } from '@/lib/nav/search';
import type { NavFilters } from '@/lib/nav/use-nav';

export type SpecFilter = NavFilters['specs'];
export type SpecGroupKey = 'active' | 'planned' | 'completed';

export const SPEC_GROUP_ORDER: readonly SpecGroupKey[] = ['active', 'planned', 'completed'];

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

export function groupKeyOf(spec: SpecSummary, cycles: readonly CycleSummary[]): SpecGroupKey {
  if (isSpecClosed(spec)) return 'completed';
  return isSpecActive(spec, cycles) ? 'active' : 'planned';
}

export function passesFilter(spec: SpecSummary, cycles: readonly CycleSummary[], filter: SpecFilter): boolean {
  if (filter === 'active') return isSpecActive(spec, cycles);
  if (filter === 'closed') return isSpecClosed(spec);
  return true;
}

export interface SpecRowModel {
  spec: SpecSummary;
  cycle: CycleSummary | null;
}

export interface SpecGroupModel {
  key: SpecGroupKey;
  rows: SpecRowModel[];
}

export function matchesSpecQuery(query: string, spec: SpecSummary, cycle: CycleSummary | null, statusLabel = ''): boolean {
  return matchesQuery(query, spec.title, spec.id, spec.module, spec.app, spec.status, statusLabel, cycle?.cycle);
}

export type SpecStatusLabeler = (status: string) => string;

export function buildSpecGroups(snapshot: WorkspaceSnapshot, filter: SpecFilter, query: string, statusLabelOf: SpecStatusLabeler = () => ''): SpecGroupModel[] {
  const rows = snapshot.specs
    .map((spec) => ({ spec, cycle: currentCycleOf(snapshot.cycles, spec.id) }))
    .filter(({ spec, cycle }) => passesFilter(spec, snapshot.cycles, filter) && matchesSpecQuery(query, spec, cycle, statusLabelOf(spec.status)))
    .map(({ spec, cycle }): SpecRowModel & { group: SpecGroupKey } => ({ spec, cycle, group: groupKeyOf(spec, snapshot.cycles) }))
    .sort((a, b) => a.spec.title.localeCompare(b.spec.title));
  return SPEC_GROUP_ORDER.flatMap((key) => {
    const own = rows.filter((row) => row.group === key).map(({ spec, cycle }) => ({ spec, cycle }));
    return own.length > 0 ? [{ key, rows: own }] : [];
  });
}

export function countByFilter(snapshot: WorkspaceSnapshot): Record<SpecFilter, number> {
  return {
    active: snapshot.specs.filter((s) => isSpecActive(s, snapshot.cycles)).length,
    closed: snapshot.specs.filter(isSpecClosed).length,
    all: snapshot.specs.length,
  };
}

export type PlanDocumentName = 'plan.md' | 'functional.md' | 'planner.md' | 'architect.md';

export interface ExpectedPlan {
  names: PlanDocumentName[];
  optional: boolean;
}

export function expectedPlanDocuments(flow: string): ExpectedPlan {
  if (flow === 'lite') return { names: ['plan.md'], optional: false };
  if (flow === 'reduced') return { names: ['planner.md', 'architect.md'], optional: true };
  return { names: ['functional.md', 'planner.md', 'architect.md'], optional: false };
}

export const cycleDirectory = (spec: SpecSummary, cycle: string): string => `${spec.folder.replace(/\/+$/, '')}/cycles/${cycle}`;

export const cycleDocumentPath = (spec: SpecSummary, cycle: string, name: string): string => `${cycleDirectory(spec, cycle)}/${name}`;

export type PlanItemState = 'present' | 'pending' | 'unknown';

export interface PlanItem {
  name: PlanDocumentName;
  path: string;
  state: PlanItemState;
}

export function planItemsOf(spec: SpecSummary, cycle: CycleSummary): { items: PlanItem[]; optional: boolean } {
  const { names, optional } = expectedPlanDocuments(cycle.flow);
  const known = cycle.documents;
  const items = names.map((name): PlanItem => ({
    name,
    path: cycleDocumentPath(spec, cycle.cycle, name),
    state: known === undefined ? 'unknown' : known.includes(name) ? 'present' : 'pending',
  }));
  return { items, optional };
}

export const fileNameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

export function viewerTypeOf(path: string): AgentGeneratedDocument['type'] {
  const name = fileNameOf(path);
  if (/\/fixes\//.test(path)) return 'fix';
  if (name === 'plan.md') return 'plan';
  if (name === 'tasks.json') return 'wbs';
  if (name === 'architect.md') return 'architecture';
  if (name === 'cycle.json' || name === 'brief.yaml') return 'review';
  return 'spec';
}

export const toViewerDocument = (path: string): AgentGeneratedDocument => ({ id: path, name: fileNameOf(path), path, type: viewerTypeOf(path), status: 'generated' });

export interface DocumentGroup {
  id: string;
  cycle: string | null;
  kind: 'spec' | 'cycle' | 'fixes';
  paths: string[];
}

export function documentGroupsOf(spec: SpecSummary, cycles: readonly CycleSummary[], fixes: readonly FixSummary[]): DocumentGroup[] {
  const groups: DocumentGroup[] = [];
  if (spec.document) groups.push({ id: 'spec', cycle: null, kind: 'spec', paths: [spec.document] });
  for (const cycle of cyclesOf(cycles, spec.id)) {
    const documents = cycle.documents ?? [];
    if (documents.length > 0) groups.push({ id: cycle.cycle, cycle: cycle.cycle, kind: 'cycle', paths: documents.map((name) => cycleDocumentPath(spec, cycle.cycle, name)) });
  }
  const fixDocuments = fixes.flatMap((fix) => (fix.specId === spec.id && fix.document ? [fix.document] : []));
  if (fixDocuments.length > 0) groups.push({ id: 'fixes', cycle: null, kind: 'fixes', paths: fixDocuments });
  return groups;
}

export function threadsOfSpec(threads: readonly ThreadInfo[], specId: string): ThreadInfo[] {
  const channel = channelForSpec(specId);
  return threads
    .filter((info) => info.channelId === channel || linkEntriesOf(info).some((entry) => (entry.kind === 'spec' || entry.kind === 'cycle') && entry.specId === specId))
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

export const fixesOfSpec = (fixes: readonly FixSummary[], specId: string): FixSummary[] => fixes.filter((fix) => fix.specId === specId);

export const TASK_STATUS_ORDER = ['in-progress', 'pending', 'blocked', 'done', 'skipped'] as const;
export type TaskStatusKey = (typeof TASK_STATUS_ORDER)[number] | 'other';

export const taskStatusKeyOf = (status: string): TaskStatusKey => ((TASK_STATUS_ORDER as readonly string[]).includes(status) ? (status as TaskStatusKey) : 'other');

export function effectiveCycle(cycles: readonly CycleSummary[], specId: string, picked: string | null): CycleSummary | null {
  const own = cyclesOf(cycles, specId);
  return own.find((c) => c.cycle === picked) ?? currentCycleOf(cycles, specId);
}

export function activityEventsOf<T extends { at?: string }>(events: readonly T[]): T[] {
  const newestFirst = [...events].reverse();
  const dated = newestFirst.filter((e) => e.at).sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  return [...dated, ...newestFirst.filter((e) => !e.at)];
}
