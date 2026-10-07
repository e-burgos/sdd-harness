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
  it('allows when specs or fixes could not be read', () => {
    expect(judgeEdit({ ...idle, stale: ['specs'] }, ROOT, `${ROOT}/apps/a.ts`)).toEqual({ kind: 'allow' });
  });
  it('allows files outside the repo (not ours to judge)', () => {
    expect(judgeEdit(idle, ROOT, '/tmp/x.ts')).toEqual({ kind: 'allow' });
  });
});
