import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { BatchSummary, CycleSummary, ThreadContextSource } from '@sdd-studio/protocol';
import { composeStablePrefix } from '../engine/stable-prefix';
import { createPackRunner, PACK_NO_PACKS_EXIT, PACK_TIMEOUT_MS, PACK_USAGE_EXIT, type PackRunner } from '../workspace/pack-runner';

export const PACK_ROLE_OF_AGENT: Readonly<Record<string, string>> = {
  'sdd-implementor-back': 'implementor-back',
  'sdd-implementor-front': 'implementor-front',
  'sdd-reviewer': 'reviewer',
  'sdd-functional': 'functional',
  'sdd-planner': 'planner',
  'sdd-architect': 'architect',
};

const FINISHED_TASK = new Set(['done', 'skipped']);

export interface PackTarget {
  spec: string;
  cycle: string;
  role: string;
  unit: string | null;
  app?: string;
}

export interface ThreadContext {
  prefix: string;
  source: ThreadContextSource;
}

export const packRoleOf = (agent: string): string | null => PACK_ROLE_OF_AGENT[agent] ?? null;

export function pendingBatchOf(cycle: Pick<CycleSummary, 'batches' | 'tasks'>, role: string): BatchSummary | null {
  const statusOf = new Map(cycle.tasks.map((task) => [task.id, task.status]));
  return (
    (cycle.batches ?? []).find(
      (batch) => batch.role === role && batch.tasks.some((id) => !FINISHED_TASK.has(statusOf.get(id) ?? 'pending')),
    ) ?? null
  );
}

export function firstPendingBatch(cycle: Pick<CycleSummary, 'batches' | 'tasks'>): BatchSummary | null {
  const statusOf = new Map(cycle.tasks.map((task) => [task.id, task.status]));
  return (cycle.batches ?? []).find((batch) => batch.tasks.some((id) => !FINISHED_TASK.has(statusOf.get(id) ?? 'pending'))) ?? null;
}

export function cycleRoleApp(cycle: Pick<CycleSummary, 'apps' | 'batches' | 'tasks'>): string | undefined {
  if (cycle.apps.length < 2) return undefined;
  return firstPendingBatch(cycle)?.app ?? cycle.apps[0];
}

export const packKeyOf = (target: PackTarget): string => `${target.spec}|${target.cycle}|${target.role}|${target.unit ?? ''}|${target.app ?? ''}`;

export const unitLineOf = (target: PackTarget, root: string): string =>
  `Unidad SDD → ${target.spec} · ${target.cycle} · ${target.role}${target.unit ? ` · ${target.unit}` : ''} · worktree: ${root}`;

const mtimeOf = (file: string): number => {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return -1;
  }
};

type RoleKind = 'batch' | 'cycle';

interface CacheEntry {
  stamp: string;
  value: ThreadContext | null;
}

export interface PackContext {
  targetOf(agent: string, unit: { spec: string; cycle: string }, cycle: CycleSummary | undefined): PackTarget | null;
  peek(target: PackTarget): ThreadContext | null | undefined;
  load(target: PackTarget): Promise<ThreadContext | null>;
}

export interface PackContextDeps {
  root: string;
  readLessons: () => string;
  run?: PackRunner;
}

export function createPackContext(deps: PackContextDeps): PackContext {
  const run = deps.run ?? createPackRunner(deps.root);
  const cache = new Map<string, CacheEntry>();
  const inFlight = new Map<string, Promise<ThreadContext | null>>();
  const packsFile = path.join(deps.root, 'sdd', 'packs.json');

  const roleKindOf = (role: string): RoleKind | null => {
    try {
      const parsed = JSON.parse(readFileSync(packsFile, 'utf8')) as { roles?: Record<string, { unit?: unknown }> };
      const unit = parsed.roles?.[role]?.unit;
      return unit === 'batch' || unit === 'cycle' ? unit : null;
    } catch {
      return null;
    }
  };

  const stampOf = (target: PackTarget): string =>
    `${mtimeOf(path.join(deps.root, 'sdd', 'specs', target.spec, 'cycles', target.cycle, 'tasks.json'))}|${mtimeOf(packsFile)}`;

  const build = async (target: PackTarget): Promise<ThreadContext | null> => {
    const args = [target.spec, target.cycle, target.role, ...(target.unit ? [target.unit] : []), ...(target.app ? ['--app', target.app] : []), '--stdout'];
    const result = await run(args, PACK_TIMEOUT_MS);
    if (result.code === 0 && result.stdout.trim().length > 0) {
      const wrapped = composeStablePrefix([{ source: `pack:${target.unit ?? 'cycle'}.${target.role}`, content: result.stdout.trim() }]);
      const prefix = [deps.readLessons(), unitLineOf(target, deps.root), wrapped].filter((part) => part.length > 0).join('\n\n');
      return {
        prefix,
        source: { kind: 'pack', spec: target.spec, cycle: target.cycle, role: target.role, unit: target.unit, bytes: Buffer.byteLength(result.stdout) },
      };
    }
    if (result.code === PACK_USAGE_EXIT || result.code === PACK_NO_PACKS_EXIT) return null;
    throw new Error(`sdd-pack exited with ${result.code}`);
  };

  return {
    targetOf(agent, unit, cycle) {
      const role = packRoleOf(agent);
      if (!role || !cycle) return null;
      const kind = roleKindOf(role);
      if (kind === null) return null;
      if (kind === 'cycle') {
        const app = cycleRoleApp(cycle);
        return { spec: unit.spec, cycle: unit.cycle, role, unit: null, ...(app ? { app } : {}) };
      }
      const batch = pendingBatchOf(cycle, role);
      return batch ? { spec: unit.spec, cycle: unit.cycle, role, unit: batch.id } : null;
    },
    peek(target) {
      const entry = cache.get(packKeyOf(target));
      return entry && entry.stamp === stampOf(target) ? entry.value : undefined;
    },
    load(target) {
      const key = packKeyOf(target);
      const stamp = stampOf(target);
      const entry = cache.get(key);
      if (entry && entry.stamp === stamp) return Promise.resolve(entry.value);
      const pending = inFlight.get(key);
      if (pending) return pending;
      const started = build(target)
        .then((value) => {
          cache.set(key, { stamp, value });
          return value;
        })
        .catch(() => null)
        .finally(() => inFlight.delete(key));
      inFlight.set(key, started);
      return started;
    },
  };
}
