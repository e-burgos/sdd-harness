import { z } from 'zod';

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
});
export type SpecSummary = z.infer<typeof SpecSummary>;

export const FixSummary = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  severity: z.string().nullable(),
  specId: z.string().nullable(),
});
export type FixSummary = z.infer<typeof FixSummary>;

export const AgentSummary = z.object({
  id: z.string(),
  description: z.string(),
  model: z.string().nullable(),
});
export type AgentSummary = z.infer<typeof AgentSummary>;

export const GateMode = z.enum(['block', 'warn']);
export type GateMode = z.infer<typeof GateMode>;

export const WorkspaceSnapshot = z.object({
  project: z.string(),
  profile: z.string(),
  kitVersion: z.string().nullable(),
  specs: z.array(SpecSummary),
  cycles: z.array(CycleSummary),
  fixes: z.array(FixSummary),
  agents: z.array(AgentSummary),
  gateMode: GateMode,
  pricing: z.record(z.string(), z.unknown()).nullable(),
  stale: z.array(Area),
});
export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshot>;
