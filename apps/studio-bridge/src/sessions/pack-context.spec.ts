import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CycleSummary } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackRunResult, PackRunner } from '../workspace/pack-runner';
import { PACK_ROLE_OF_AGENT, createPackContext, packRoleOf, pendingBatchOf, unitLineOf } from './pack-context';

const SPEC = 'spec-x-001-demo';
let root: string;

const put = async (relative: string, content: string): Promise<string> => {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
  return file;
};

const cycleOf = (tasks: Array<[string, string]>, batches: CycleSummary['batches']): CycleSummary => ({
  specId: SPEC,
  cycle: 'cycle-01',
  status: 'in-progress',
  flow: 'lite',
  apps: ['apps/a'],
  tasks: tasks.map(([id, status]) => ({ id, title: id, status, storyPoints: 1 })),
  tasksTotal: tasks.length,
  tasksDone: 0,
  batches,
});

const batch = (id: string, role: string, tasks: string[]) => ({ id, app: 'apps/a', role, tasks, dependsOn: [] });
const unit = { spec: SPEC, cycle: 'cycle-01' };

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'pack-context-'));
  await put('sdd/packs.json', JSON.stringify({ roles: { 'implementor-back': { unit: 'batch' }, reviewer: { unit: 'cycle' } } }));
  await put(`sdd/specs/${SPEC}/cycles/cycle-01/tasks.json`, '[]');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('role map', () => {
  it('maps the six SDD agents and leaves the rest on the base prefix', () => {
    expect(PACK_ROLE_OF_AGENT).toEqual({
      'sdd-implementor-back': 'implementor-back',
      'sdd-implementor-front': 'implementor-front',
      'sdd-reviewer': 'reviewer',
      'sdd-functional': 'functional',
      'sdd-planner': 'planner',
      'sdd-architect': 'architect',
    });
    for (const agent of ['sdd-orchestrator', 'sdd-steward', 'sdd-hermes', 'default']) expect(packRoleOf(agent)).toBeNull();
  });
});

describe('pendingBatchOf', () => {
  const batches = [batch('B-01', 'implementor-back', ['T1', 'T2']), batch('B-02', 'implementor-back', ['T3']), batch('B-03', 'reviewer', ['T4'])];
  it('picks the first batch of the role with a task that is not done or skipped', () => {
    const cycle = cycleOf([['T1', 'done'], ['T2', 'skipped'], ['T3', 'pending'], ['T4', 'pending']], batches);
    expect(pendingBatchOf(cycle, 'implementor-back')?.id).toBe('B-02');
  });
  it('treats in-progress as pending and unknown tasks as pending', () => {
    expect(pendingBatchOf(cycleOf([['T1', 'in-progress']], batches), 'implementor-back')?.id).toBe('B-01');
    expect(pendingBatchOf(cycleOf([], batches), 'implementor-back')?.id).toBe('B-01');
  });
  it('returns null when nothing is pending or there are no batches', () => {
    expect(pendingBatchOf(cycleOf([['T1', 'done'], ['T2', 'done'], ['T3', 'done']], batches), 'implementor-back')).toBeNull();
    expect(pendingBatchOf(cycleOf([], undefined), 'implementor-back')).toBeNull();
  });
});

describe('targetOf', () => {
  const ctx = () => createPackContext({ root, readLessons: () => '' });
  const cycle = cycleOf([['T1', 'pending']], [batch('B-01', 'implementor-back', ['T1'])]);
  it('gives a batch role its pending block and a cycle role no unit', () => {
    expect(ctx().targetOf('sdd-implementor-back', unit, cycle)).toEqual({ ...unit, role: 'implementor-back', unit: 'B-01' });
    expect(ctx().targetOf('sdd-reviewer', unit, cycle)).toEqual({ ...unit, role: 'reviewer', unit: null });
  });
  it('falls back to base for a batch role without a pending block, an unmapped agent or a role missing in packs.json', () => {
    expect(ctx().targetOf('sdd-implementor-back', unit, cycleOf([['T1', 'done']], cycle.batches))).toBeNull();
    expect(ctx().targetOf('sdd-orchestrator', unit, cycle)).toBeNull();
    expect(ctx().targetOf('sdd-planner', unit, cycle)).toBeNull();
    expect(ctx().targetOf('sdd-reviewer', unit, undefined)).toBeNull();
  });
  it('falls back to base when packs.json is missing', async () => {
    await rm(path.join(root, 'sdd/packs.json'));
    expect(ctx().targetOf('sdd-reviewer', unit, cycle)).toBeNull();
  });
});

describe('load', () => {
  const target = { ...unit, role: 'implementor-back', unit: 'B-01' };
  const runner = (result: PackRunResult | Error = { code: 0, stdout: '# pack\n' }) => {
    const calls: Array<{ args: string[]; timeoutMs: number }> = [];
    const run: PackRunner = async (args, timeoutMs) => {
      calls.push({ args, timeoutMs });
      if (result instanceof Error) throw result;
      return result;
    };
    return { run, calls };
  };

  it('runs sdd-pack with --stdout and composes lessons, the unit line and the wrapped pack', async () => {
    const { run, calls } = runner();
    const context = await createPackContext({ root, readLessons: () => 'LESSONS', run }).load(target);
    expect(calls).toEqual([{ args: [SPEC, 'cycle-01', 'implementor-back', 'B-01', '--stdout'], timeoutMs: 15_000 }]);
    expect(context?.prefix).toBe(
      `LESSONS\n\n${unitLineOf(target, root)}\n\n<project-context source="pack:B-01.implementor-back">\n# pack\n</project-context>`,
    );
    expect(unitLineOf(target, root)).toBe(`Unidad SDD → ${SPEC} · cycle-01 · implementor-back · B-01 · worktree: ${root}`);
    expect(context?.source).toEqual({ kind: 'pack', spec: SPEC, cycle: 'cycle-01', role: 'implementor-back', unit: 'B-01', bytes: 7 });
  });

  it('omits the unit id for cycle roles', async () => {
    const { run, calls } = runner();
    const context = await createPackContext({ root, readLessons: () => '', run }).load({ ...unit, role: 'reviewer', unit: null });
    expect(calls[0]?.args).toEqual([SPEC, 'cycle-01', 'reviewer', '--stdout']);
    expect(context?.prefix).toContain('source="pack:cycle.reviewer"');
    expect(context?.source).toMatchObject({ unit: null });
  });

  it('falls back (null) on exit 2, exit 3, a timeout and a runner failure', async () => {
    for (const result of [{ code: 2, stdout: '' }, { code: 3, stdout: '' }, { code: -1, stdout: '' }, new Error('boom')]) {
      const { run } = runner(result);
      expect(await createPackContext({ root, readLessons: () => '', run }).load(target)).toBeNull();
    }
  });

  it('does not cache a timeout, so the next load retries', async () => {
    const results: PackRunResult[] = [{ code: -1, stdout: '' }, { code: 0, stdout: 'ok' }];
    const run = vi.fn(async () => results.shift()!);
    const context = createPackContext({ root, readLessons: () => '', run });
    expect(await context.load(target)).toBeNull();
    expect(await context.load(target)).not.toBeNull();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('caches by spec, cycle, role and unit and shares an in-flight run', async () => {
    const { run, calls } = runner();
    const context = createPackContext({ root, readLessons: () => '', run });
    expect(context.peek(target)).toBeUndefined();
    await Promise.all([context.load(target), context.load(target)]);
    await context.load(target);
    expect(calls).toHaveLength(1);
    expect(context.peek(target)).not.toBeNull();
    await context.load({ ...target, unit: 'B-02' });
    expect(calls).toHaveLength(2);
  });

  it('caches an exit 3 fallback so it does not rerun every message', async () => {
    const { run, calls } = runner({ code: 3, stdout: '' });
    const context = createPackContext({ root, readLessons: () => '', run });
    await context.load(target);
    await context.load(target);
    expect(calls).toHaveLength(1);
    expect(context.peek(target)).toBeNull();
  });

  it.each([`sdd/specs/${SPEC}/cycles/cycle-01/tasks.json`, 'sdd/packs.json'])('invalidates the cache when the mtime of %s changes', async (file) => {
    const { run, calls } = runner();
    const context = createPackContext({ root, readLessons: () => '', run });
    await context.load(target);
    const later = new Date(Date.now() + 60_000);
    await utimes(path.join(root, file), later, later);
    expect(context.peek(target)).toBeUndefined();
    await context.load(target);
    expect(calls).toHaveLength(2);
  });
});
