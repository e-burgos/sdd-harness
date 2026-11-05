import { describe, it, expect } from 'vitest';
import { collectAppTopologyIssues, validateAppTopology } from '../app-types.js';

describe('validateAppTopology: option placement', () => {
  it('rejects ml on non-python apps', () => {
    const errors = validateAppTopology([{ name: 'api', type: 'nestjs', ml: true }], 'nx');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"ml"');
    expect(validateAppTopology([{ name: 'agent', type: 'python', ml: true }], 'nx')).toEqual([]);
  });

  it.each(['nestjs', 'fastify', 'hono', 'python', 'springboot'])('rejects tucuUi on %s', (type) => {
    const errors = validateAppTopology([{ name: 'svc', type, tucuUi: false }], 'nx');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"tucuUi"');
  });

  it.each(['react', 'nextjs', 'next-bff', 'mfe-shell', 'mfe'])('accepts tucuUi on %s', (type) => {
    const apps = [
      { name: 'portal', type: 'mfe-shell' },
      { name: 'ui', type, tucuUi: false, ...(type === 'mfe' ? { shell: 'portal' } : {}) },
    ].filter((app) => !(type === 'mfe-shell' && app.name === 'portal'));
    expect(validateAppTopology(type === 'mfe' ? [{ name: 'portal', type: 'mfe-shell' }, apps[1]] : apps, 'nx')).toEqual([]);
  });

  it('applies the same checks in standalone mode', () => {
    expect(validateAppTopology([{ name: 'api', type: 'nestjs', ml: true }], 'standalone')).toHaveLength(1);
  });
});

describe('collectAppTopologyIssues', () => {
  it('returns structured issues whose messages match validateAppTopology', () => {
    const apps = [
      { name: 'api', type: 'nestjs', ml: true, tucuUi: false },
      { name: 'ui', type: 'mfe' },
      { name: 'oops', type: 'react', shell: 'x' },
    ];
    const issues = collectAppTopologyIssues(apps, 'nx');
    expect(issues.map((i) => [i.appIndex, i.field, i.code])).toEqual([
      [0, 'ml', 'ml-not-python'],
      [0, 'tucuUi', 'tucu-ui-not-frontend'],
      [1, 'shell', 'shell-missing'],
      [2, 'shell', 'shell-not-mfe'],
    ]);
    expect(issues.map((i) => i.message)).toEqual(validateAppTopology(apps, 'nx'));
  });

  it('flags workspace-only types in standalone and the remaining shell codes', () => {
    expect(collectAppTopologyIssues([{ name: 'bff', type: 'next-bff' }], 'standalone')).toMatchObject([
      { appIndex: 0, field: 'type', code: 'workspace-only-type' },
    ]);
    const codes = (apps: Parameters<typeof collectAppTopologyIssues>[0]) =>
      collectAppTopologyIssues(apps, 'nx').map((i) => i.code);
    expect(codes([{ name: 'm', type: 'mfe', shell: 'nope' }])).toEqual(['shell-not-found']);
    expect(codes([{ name: 'a', type: 'react' }, { name: 'm', type: 'mfe', shell: 'a' }])).toEqual(['shell-not-mfe-shell']);
    expect(
      codes([{ name: 's1', type: 'mfe-shell' }, { name: 's2', type: 'mfe-shell' }, { name: 'm', type: 'mfe' }]),
    ).toEqual(['shell-ambiguous']);
  });
});
