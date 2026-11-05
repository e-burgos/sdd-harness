import { previewTree, sourceFromResolved, sourceFromState } from '../preview-tree';
import { catalogFixture, run, scoped } from './fixtures';

describe('previewTree', () => {
  it('lists apps, libs, sdd and compose for a monorepo', () => {
    const state = run(
      [
        { type: 'project', patch: { name: 'acme' } },
        { type: 'app-add', appType: 'react' },
        { type: 'app-add', appType: 'nestjs' },
        { type: 'lib-toggle', libType: 'shared-types' },
        { type: 'service-toggle', serviceType: 'postgres' },
      ],
      scoped('fullstack', 'nx'),
    );
    const source = sourceFromState(state, catalogFixture);
    expect(source).not.toBeNull();
    expect(previewTree(source!).map((n) => `${n.depth}:${n.name}`)).toEqual([
      '0:acme/',
      '1:apps/',
      '2:web/',
      '2:api/',
      '1:libs/',
      '2:shared-types/',
      '1:tools/',
      '1:sdd/',
      '1:harness.config.json',
      '1:docker-compose.yml',
    ]);
  });

  it('puts the single app at the root in standalone and drops libs', () => {
    const state = run([{ type: 'project', patch: { name: 'solo' } }, { type: 'app-add', appType: 'nestjs' }], scoped('back', 'standalone'));
    const nodes = previewTree(sourceFromState(state, catalogFixture)!);
    expect(nodes.map((n) => n.name)).toEqual(['solo/', './', 'sdd/', 'harness.config.json']);
    expect(nodes[1]?.detail).toContain('nestjs');
  });

  it('has no source until a mode is chosen', () => {
    expect(sourceFromState(run([]), catalogFixture)).toBeNull();
  });

  it('prefers the paths of the resolved config', () => {
    const source = sourceFromResolved({
      mode: 'nx',
      project: { name: 'r', packageScope: '@r' },
      apps: [{ name: 'web', type: 'react', path: 'apps/web', port: 3000, portSource: 'default', tucuUi: true, ml: false, shell: null, route: null, stack: 'React' }],
      libs: [],
      services: [],
      dockerCompose: false,
      profile: 'team',
    });
    expect(previewTree(source).find((n) => n.kind === 'app')?.detail).toBe('react · React');
  });
});
