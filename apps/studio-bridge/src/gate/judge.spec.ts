import type { WorkspaceSnapshot } from '@sdd-studio/protocol';
import { describe, expect, it } from 'vitest';
import { editTargetOf, isCodePath, judgeEdit, relativeToRoot } from './judge';

const idle: WorkspaceSnapshot = {
  project: 'p', profile: 'team', kitVersion: null, specs: [], agents: [], gateMode: 'block', pricing: null, stale: [],
  cycles: [{ specId: 's', cycle: 'cycle-01', status: 'completed', flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0 }],
  fixes: [{ id: 'F', title: 'f', status: 'resolved', severity: null, specId: null }],
};
const ROOT = '/repo with spaces';

describe('relativeToRoot', () => {
  it.each([
    ['/repo with spaces/apps/a.ts', 'apps/a.ts'],
    ['apps/../apps/b.ts', 'apps/b.ts'],
    ['/elsewhere/x.ts', null],
  ])('%s → %s', (input, expected) => {
    expect(relativeToRoot(ROOT, input)).toBe(expected);
  });
  it('normalizes the root (double slash, dot, trailing slash)', () => {
    expect(relativeToRoot('/a//repo', '/a/repo/apps/a.ts')).toBe('apps/a.ts');
    expect(relativeToRoot('/a/./repo', '/a/repo/apps/a.ts')).toBe('apps/a.ts');
    expect(relativeToRoot('/a/repo/', '/a/repo/apps/a.ts')).toBe('apps/a.ts');
  });
  it('does not match sibling prefixes', () => {
    expect(relativeToRoot('/repo', '/repo2/x.ts')).toBeNull();
  });
  it('compares Windows drive letters case-insensitively', () => {
    expect(relativeToRoot('C:\\work\\repo', 'c:\\work\\repo\\apps\\a.ts')).toBe('apps/a.ts');
  });
  it('compares case-insensitively on darwin/win32 keeping file casing', (ctx) => {
    if (process.platform !== 'darwin' && process.platform !== 'win32') ctx.skip();
    expect(relativeToRoot('/Users/x/Repo', '/Users/x/repo/Apps/a.ts')).toBe('Apps/a.ts');
  });
  it('handles Windows paths', () => {
    expect(relativeToRoot('C:\\work\\repo', 'C:\\work\\repo\\apps\\a.ts')).toBe('apps/a.ts');
    expect(relativeToRoot('C:\\work\\repo', 'D:\\other\\a.ts')).toBeNull();
  });
});

describe('isCodePath', () => {
  it.each([
    ['apps/a.ts', true], ['README.md', false], ['package.json', true],
    ['sdd/specs/x.md', false], ['.claude/agents/x.md', false], ['libs/x/README.md', true],
  ])('%s → %s', (rel, expected) => {
    expect(isCodePath(rel)).toBe(expected);
  });
});

describe('editTargetOf', () => {
  it('extracts file_path / notebook_path from edit tools only', () => {
    expect(editTargetOf('Edit', { file_path: '/a' })).toBe('/a');
    expect(editTargetOf('NotebookEdit', { notebook_path: '/n.ipynb' })).toBe('/n.ipynb');
    expect(editTargetOf('Bash', { command: 'rm -rf /' })).toBeNull();
    expect(editTargetOf('Write', {})).toBeNull();
    expect(editTargetOf('Write', { file_path: '/w' })).toBe('/w');
    expect(editTargetOf('MultiEdit', { file_path: '/m' })).toBe('/m');
  });
  it('picks the key per tool, ignoring decoys', () => {
    expect(editTargetOf('NotebookEdit', { file_path: 'sdd/x.md', notebook_path: '/n.ipynb' })).toBe('/n.ipynb');
    expect(editTargetOf('Edit', { file_path: '/a', notebook_path: '/n.ipynb' })).toBe('/a');
    expect(editTargetOf('Edit', { notebook_path: '/n.ipynb' })).toBeNull();
  });
});

describe('judgeEdit', () => {
  it('denies code edits without an active cycle or open fix in block mode', () => {
    const v = judgeEdit(idle, ROOT, `${ROOT}/apps/a.ts`);
    expect(v.kind).toBe('deny');
    expect(v.kind !== 'allow' && v.reason).toContain('SPEC GATE');
  });
  it('warns in warn mode', () => {
    expect(judgeEdit({ ...idle, gateMode: 'warn' }, ROOT, `${ROOT}/apps/a.ts`).kind).toBe('warn');
  });
  it('allows sdd/ and docs at the root', () => {
    expect(judgeEdit(idle, ROOT, `${ROOT}/sdd/specs/x.md`)).toEqual({ kind: 'allow' });
    expect(judgeEdit(idle, ROOT, `${ROOT}/README.md`)).toEqual({ kind: 'allow' });
  });
  it('allows with an in-progress cycle or an open fix', () => {
    const cycle = structuredClone(idle);
    cycle.cycles[0]!.status = 'in-progress';
    expect(judgeEdit(cycle, ROOT, `${ROOT}/apps/a.ts`)).toEqual({ kind: 'allow' });
    const fix = structuredClone(idle);
    fix.fixes[0]!.status = 'in-progress';
    expect(judgeEdit(fix, ROOT, `${ROOT}/apps/a.ts`)).toEqual({ kind: 'allow' });
  });
  it('allows when specs are stale and there is no last-good data', () => {
    expect(judgeEdit({ ...idle, stale: ['specs'] }, ROOT, `${ROOT}/apps/a.ts`)).toEqual({ kind: 'allow' });
  });
  it('judges on last-good data when stale but specs are known', () => {
    const spec = { id: 's', title: 's', status: 'approved', folder: 'f', module: null, app: null, dependsOn: [] };
    expect(judgeEdit({ ...idle, specs: [spec], stale: ['specs'] }, ROOT, `${ROOT}/apps/a.ts`).kind).toBe('deny');
  });
  it('judges stale fixes on kept data', () => {
    expect(judgeEdit({ ...idle, stale: ['fixes'] }, ROOT, `${ROOT}/apps/a.ts`).kind).toBe('deny');
  });
  it('allows with a pending fix', () => {
    const fix = structuredClone(idle);
    fix.fixes[0]!.status = 'pending';
    expect(judgeEdit(fix, ROOT, `${ROOT}/apps/a.ts`)).toEqual({ kind: 'allow' });
  });
  it.each(['completed', 'cancelled'])('ignores in-progress cycles under a %s spec', (status) => {
    const snap = structuredClone(idle);
    snap.cycles[0]!.status = 'in-progress';
    snap.specs = [{ id: 's', title: 's', status, folder: 'f', module: null, app: null, dependsOn: [] }];
    expect(judgeEdit(snap, ROOT, `${ROOT}/apps/a.ts`).kind).toBe('deny');
  });
  it('points to the real gate command', () => {
    const v = judgeEdit(idle, ROOT, `${ROOT}/apps/a.ts`);
    expect(v.kind !== 'allow' && v.reason).toContain('pnpm sdd:gate <spec> → sdd-orchestrator');
  });
  it('allows files outside the repo (not ours to judge)', () => {
    expect(judgeEdit(idle, ROOT, '/tmp/x.ts')).toEqual({ kind: 'allow' });
  });
});
