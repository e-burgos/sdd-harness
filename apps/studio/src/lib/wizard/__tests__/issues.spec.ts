import type { ConfigIssue } from '@sdd-studio/protocol';
import { isBlockingIssue, issueTextKey, issuesBlockGeneration, issuesForField, issuesForStep, mapIssue, mapIssues } from '../issues';
import { run, scoped } from './fixtures';

const issue = (code: string, path: ConfigIssue['path'], severity: ConfigIssue['severity'] = 'error'): ConfigIssue => ({
  severity,
  code,
  path,
  message: `cli says ${code}`,
});

const state = run(
  [
    { type: 'app-add', appType: 'react' },
    { type: 'app-add', appType: 'nestjs' },
  ],
  scoped('fullstack', 'nx'),
);

describe('mapIssue', () => {
  it('routes app issues to the front or back step by the role of the row', () => {
    expect(mapIssue(issue('tucu-ui-not-frontend', ['apps', 0, 'tucuUi']), state)).toMatchObject({ step: 'front', field: 'apps.0.tucuUi' });
    expect(mapIssue(issue('ml-not-python', ['apps', 1, 'ml']), state)).toMatchObject({ step: 'back', field: 'apps.1.ml' });
  });

  it('routes a path-less topology issue to the front step', () => {
    expect(mapIssue(issue('shell-missing', ['apps']), state)).toMatchObject({ step: 'front', field: 'apps' });
  });

  it('routes the other roots', () => {
    expect(mapIssue(issue('too_small', ['project', 'name']), state)).toMatchObject({ step: 'shape', field: 'project.name' });
    expect(mapIssue(issue('duplicate-lib-name', ['libs', 1, 'name']), state)).toMatchObject({ step: 'extras', field: 'libs.1.name' });
    expect(mapIssue(issue('x', ['sdd', 'author']), state).step).toBe('extras');
    expect(mapIssue(issue('x', []), state)).toMatchObject({ step: 'summary', field: null });
    expect(mapIssue(issue('x', ['apps', 9, 'name']), state).step).toBe('front');
  });

  it('uses the translation when the code has one', () => {
    const calls: Array<[string, Record<string, string | number>]> = [];
    const mapped = mapIssue(issue('ml-not-python', ['apps', 1, 'ml']), state, (key, params) => {
      calls.push([key, params]);
      return `translated ${params.app}`;
    });
    expect(mapped).toMatchObject({ text: 'translated api', translated: true });
    expect(calls[0][0]).toBe(issueTextKey('ml-not-python'));
  });

  it('falls back to the CLI message, never to raw JSON', () => {
    const unknown = mapIssue(issue('invalid_type', ['apps', 0, 'port']), state, () => 'should not be used');
    expect(unknown).toMatchObject({ text: 'cli says invalid_type', translated: false });
    const missingKey = mapIssue(issue('shell-missing', ['apps']), state, () => null);
    expect(missingKey).toMatchObject({ text: 'cli says shell-missing', translated: false });
    expect(unknown.text.startsWith('{')).toBe(false);
  });
});

describe('blocking', () => {
  it('blocks on errors and on port-conflict warnings only', () => {
    expect(isBlockingIssue(issue('x', [], 'error'))).toBe(true);
    expect(isBlockingIssue(issue('port-conflict', ['apps', 0, 'port'], 'warning'))).toBe(true);
    expect(isBlockingIssue(issue('standalone-libs-ignored', ['libs'], 'warning'))).toBe(false);
    expect(issuesBlockGeneration([issue('standalone-libs-ignored', ['libs'], 'warning')])).toBe(false);
    expect(issuesBlockGeneration([issue('port-conflict', ['apps', 0, 'port'], 'warning')])).toBe(true);
    expect(issuesBlockGeneration([])).toBe(false);
  });

  it('filters mapped issues by step and field', () => {
    const mapped = mapIssues([issue('a', ['apps', 0, 'name']), issue('b', ['apps', 1, 'name']), issue('c', ['project', 'name'])], state);
    expect(issuesForStep(mapped, 'back').map((m) => m.code)).toEqual(['b']);
    expect(issuesForField(mapped, 'project.name').map((m) => m.code)).toEqual(['c']);
  });
});
