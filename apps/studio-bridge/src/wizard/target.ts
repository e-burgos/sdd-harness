import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, lstat, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { TargetCheck, TargetState } from '@sdd-studio/protocol';
import { containingBase, isInsideOrEqual, nativeRealpath, validatePathShape, type PathPlatform } from './fs-paths';

export interface TargetContext {
  bases: string[];
  projectRoot: string | null;
  platform: PathPlatform;
  tolerated: string[];
}

const NOTABLE_ENTRIES = ['.git', 'harness.config.json'] as const;
const SAMPLE_LIMIT = 10;
const GENERATABLE_STATES: TargetState[] = ['missing', 'empty', 'tolerated'];

export const isGeneratable = (check: Pick<TargetCheck, 'state'>): boolean => GENERATABLE_STATES.includes(check.state);

function verdict(input: string, fields: Partial<TargetCheck> & Pick<TargetCheck, 'state'>): TargetCheck {
  return {
    input,
    resolvedPath: null,
    reason: null,
    entries: null,
    insideProject: false,
    needsConfirmation: false,
    fingerprint: null,
    ...fields,
  };
}

async function resolveThroughExistingAncestor(absolute: string): Promise<{ resolved: string; ancestor: string; missing: string[] } | 'unresolvable'> {
  const missing: string[] = [];
  let current = absolute;
  for (;;) {
    try {
      const ancestor = await nativeRealpath(current);
      return { resolved: path.join(ancestor, ...missing), ancestor, missing };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') return 'unresolvable';
      const parent = path.dirname(current);
      if (parent === current) return 'unresolvable';
      missing.unshift(path.basename(current));
      current = parent;
    }
  }
}

const isDirectory = (target: string) => stat(target).then((info) => info.isDirectory(), () => false);

const canWrite = (target: string) => access(target, constants.W_OK).then(() => true, () => false);

function fingerprintOf(resolvedPath: string, state: TargetState, names: string[], insideProject: boolean): string {
  return createHash('sha256').update(JSON.stringify([resolvedPath, state, [...names].sort(), insideProject])).digest('hex').slice(0, 16);
}

export async function checkTarget(input: string, ctx: TargetContext): Promise<TargetCheck> {
  const shapeFailure = validatePathShape(input, ctx.platform);
  if (shapeFailure) return verdict(input, { state: 'invalid', reason: shapeFailure });

  const resolution = await resolveThroughExistingAncestor(path.resolve(input));
  if (resolution === 'unresolvable') return verdict(input, { state: 'invalid', reason: 'unresolvable' });
  const { resolved, ancestor, missing } = resolution;

  const base = containingBase(resolved, ctx.bases, ctx.platform);
  if (!base) return verdict(input, { state: 'outside-allowed', reason: 'outside', resolvedPath: resolved });
  if (base.relation === 'equal') return verdict(input, { state: 'outside-allowed', reason: 'base-itself', resolvedPath: resolved });

  const insideProject = ctx.projectRoot !== null && isInsideOrEqual(resolved, ctx.projectRoot, ctx.platform) !== 'outside';
  const context = { resolvedPath: resolved, insideProject };

  if (missing.length > 0) {
    if (!(await isDirectory(ancestor))) return verdict(input, { ...context, state: 'not-directory', reason: 'ancestor' });
    if (!(await canWrite(ancestor))) return verdict(input, { ...context, state: 'not-writable', reason: 'parent' });
    return verdict(input, {
      ...context,
      state: 'missing',
      needsConfirmation: insideProject,
      fingerprint: fingerprintOf(resolved, 'missing', [], insideProject),
    });
  }

  if (!(await isDirectory(resolved))) {
    const exists = await lstat(resolved).then(() => true, () => false);
    return verdict(input, { ...context, state: exists ? 'not-directory' : 'invalid', reason: exists ? 'file' : 'unresolvable' });
  }
  if (!(await canWrite(resolved))) return verdict(input, { ...context, state: 'not-writable', reason: 'target' });

  const names = (await readdir(resolved)).sort();
  const tolerated = new Set(ctx.tolerated);
  const conflicting = names.filter((name) => !tolerated.has(name));
  const entries = {
    count: names.length,
    sample: names.slice(0, SAMPLE_LIMIT),
    conflicting: conflicting.slice(0, SAMPLE_LIMIT),
    notable: NOTABLE_ENTRIES.filter((name) => names.includes(name)),
  };
  if (conflicting.length > 0) return verdict(input, { ...context, state: 'conflicting', reason: 'content', entries });
  const state: TargetState = names.length === 0 ? 'empty' : 'tolerated';
  return verdict(input, {
    ...context,
    state,
    entries,
    needsConfirmation: state === 'tolerated' || insideProject,
    fingerprint: fingerprintOf(resolved, state, names, insideProject),
  });
}
