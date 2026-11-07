import { z } from 'zod';
import { CatalogId } from './attachments';
import { SnapshotGithub } from './github';
import { MAX_CYCLE_DOCUMENTS } from './limits';

export const AREAS = ['global', 'specs', 'fixes', 'agents', 'tools', 'pricing', 'kit'] as const;
export const Area = z.enum(AREAS);
export type Area = z.infer<typeof Area>;

export const TaskSummary = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  storyPoints: z.number().nullable(),
});
export type TaskSummary = z.infer<typeof TaskSummary>;

export const CycleSummary = z.object({
  specId: z.string(),
  cycle: z.string().regex(/^cycle-\d{2}$/),
  status: z.string(),
  flow: z.string(),
  apps: z.array(z.string()),
  tasks: z.array(TaskSummary),
  tasksTotal: z.number().int().nonnegative(),
  tasksDone: z.number().int().nonnegative(),
  documents: z.array(z.string().min(1).max(256)).max(MAX_CYCLE_DOCUMENTS).optional().catch(undefined),
});
export type CycleSummary = z.infer<typeof CycleSummary>;

export const SpecSummary = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  folder: z.string(),
  module: z.string().nullable(),
  app: z.string().nullable(),
  dependsOn: z.array(z.string()),
  document: z.string().min(1).max(512).optional().catch(undefined),
});
export type SpecSummary = z.infer<typeof SpecSummary>;

export const FixSummary = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  severity: z.string().nullable(),
  specId: z.string().nullable(),
  createdAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  document: z.string().min(1).max(512).optional().catch(undefined),
});
export type FixSummary = z.infer<typeof FixSummary>;

export const CatalogSource = z.enum(['claude', 'sdd']);
export type CatalogSource = z.infer<typeof CatalogSource>;

export const AgentSummary = z.object({
  id: z.string(),
  description: z.string(),
  model: z.string().nullable(),
  source: CatalogSource,
  path: z.string(),
});
export type AgentSummary = z.infer<typeof AgentSummary>;

export const SkillSummary = z.object({
  id: CatalogId,
  kind: z.enum(['skill', 'prompt']),
  description: z.string().max(300),
  source: CatalogSource,
  path: z.string(),
});
export type SkillSummary = z.infer<typeof SkillSummary>;

export const GateMode = z.enum(['block', 'warn']);
export type GateMode = z.infer<typeof GateMode>;

export const ToolsRevision = z.string().regex(/^[a-f0-9]{16}$/);
export type ToolsRevision = z.infer<typeof ToolsRevision>;

export const KitToolsState = z.object({
  status: z.enum(['ok', 'missing', 'invalid']),
  rtkEnabled: z.boolean().nullable(),
  modEnabled: z.boolean().nullable(),
  gate: GateMode.nullable(),
  modLinked: z.boolean(),
  revision: ToolsRevision.nullable(),
});
export type KitToolsState = z.infer<typeof KitToolsState>;

export const SessionUnit = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cycle'), specId: z.string().min(1), cycle: z.string().regex(/^cycle-\d{2}$/) }),
  z.object({ kind: z.literal('fix'), fixId: z.string().min(1) }),
]);
export type SessionUnit = z.infer<typeof SessionUnit>;

export const SessionBinding = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9._-]+$/),
  unit: SessionUnit,
  harness: z.string().min(1).max(64),
  source: z.string().min(1).max(64),
  worktree: z.string().max(1024),
  boundAt: z.string(),
  updatedAt: z.string(),
});
export type SessionBinding = z.infer<typeof SessionBinding>;

export const MAX_SESSION_BINDINGS = 64;

export const FileLeaseSummary = z.object({
  path: z.string().min(1).max(1024),
  sessionId: z.string().regex(/^[A-Za-z0-9._-]+$/),
  unit: SessionUnit.nullable(),
  harness: z.string().min(1).max(64),
  worktree: z.string().max(1024),
  acquiredAt: z.string(),
  updatedAt: z.string(),
  requestedBy: z.array(z.string().max(256)).max(16),
});
export type FileLeaseSummary = z.infer<typeof FileLeaseSummary>;

export const MAX_FILE_LEASES = 256;

export const WorkspaceSnapshot = z.object({
  project: z.string(),
  profile: z.string(),
  kitVersion: z.string().nullable(),
  specs: z.array(SpecSummary),
  cycles: z.array(CycleSummary),
  fixes: z.array(FixSummary),
  agents: z.array(AgentSummary),
  skills: z.array(SkillSummary),
  gateMode: GateMode,
  pricing: z.record(z.string(), z.unknown()).nullable(),
  tools: KitToolsState.optional().catch(undefined),
  sessions: z.array(SessionBinding).max(MAX_SESSION_BINDINGS).optional().catch(undefined),
  leases: z.array(FileLeaseSummary).max(MAX_FILE_LEASES).optional().catch(undefined),
  github: SnapshotGithub.optional().catch(undefined),
  stale: z.array(Area),
});
export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshot>;
