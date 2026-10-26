import { toViewerDocument } from './agent-documents';

const doc = (path: string) => ({ path, name: path.split('/').at(-1) ?? path, specId: 'spec-a', fixId: null, agents: ['sdd-planner'] });

describe('toViewerDocument', () => {
  it('keeps the real path and name and maps well-known files to their type', () => {
    expect(toViewerDocument(doc('sdd/specs/spec-a/cycles/cycle-01/plan.md'))).toMatchObject({
      id: 'sdd/specs/spec-a/cycles/cycle-01/plan.md',
      name: 'plan.md',
      type: 'plan',
      status: 'generated',
    });
    expect(toViewerDocument(doc('sdd/specs/spec-a/cycles/cycle-01/tasks.json')).type).toBe('wbs');
    expect(toViewerDocument(doc('sdd/specs/spec-a/cycles/cycle-01/architect.md')).type).toBe('architecture');
    expect(toViewerDocument(doc('sdd/specs/spec-a/fixes/fix-x-001.md')).type).toBe('fix');
    expect(toViewerDocument(doc('sdd/specs/spec-a/spec-a.spec.md')).type).toBe('spec');
  });

  it('always presents the document as generated', () => {
    expect(toViewerDocument(doc('sdd/specs/spec-a/cycles/cycle-01/plan.md')).status).toBe('generated');
  });
});
