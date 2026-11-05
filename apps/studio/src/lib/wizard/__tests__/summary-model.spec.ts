import type { ResolvedConfig } from '@sdd-studio/protocol';
import { initCommand, summaryModel } from '../summary-model';
import { catalogFixture, idOf, run, scoped } from './fixtures';

const resolved: ResolvedConfig = {
  mode: 'nx',
  project: { name: 'acme', packageScope: '@acme' },
  apps: [
    { name: 'web', type: 'react', path: 'apps/web', port: 3000, portSource: 'default', tucuUi: true, ml: false, shell: null, route: null, stack: 'React resolved' },
    { name: 'api', type: 'nestjs', path: 'apps/api', port: 4001, portSource: 'shifted', tucuUi: null, ml: false, shell: null, route: null, stack: 'Nest resolved' },
  ],
  libs: [],
  services: [{ type: 'postgres', port: 5432, version: '16' }],
  dockerCompose: true,
  profile: 'team',
};

const state = () =>
  run(
    [
      { type: 'app-add', appType: 'react' },
      { type: 'app-add', appType: 'nestjs' },
      { type: 'service-toggle', serviceType: 'postgres' },
    ],
    scoped('fullstack', 'nx'),
  );

describe('summaryModel', () => {
  it('uses the resolved ports, stacks and source when the CLI answered', () => {
    const model = summaryModel(state(), catalogFixture, resolved);
    expect(model.resolved).toBe(true);
    expect(model.apps.map((app) => [app.name, app.port, app.portSource, app.stack])).toEqual([
      ['web', 3000, 'default', 'React resolved'],
      ['api', 4001, 'shifted', 'Nest resolved'],
    ]);
    expect(model.services).toEqual([{ type: 'postgres', label: 'Postgres', port: 5432 }]);
    expect(model.profile).toBe('team');
  });

  it('falls back to the state without inventing ports', () => {
    const base = state();
    const edited = run([{ type: 'app-set', id: idOf(base, 'api'), patch: { portText: '4500' } }], base);
    const model = summaryModel(edited, catalogFixture, null);
    expect(model.resolved).toBe(false);
    expect(model.apps.map((app) => [app.port, app.portSource])).toEqual([
      [null, null],
      [4500, 'explicit'],
    ]);
    expect(model.apps[0]?.tucuUi).toBe(true);
    expect(model.services[0]?.port).toBe(5432);
  });

  it('joins the init command', () => {
    expect(initCommand(['init', '--config', 'harness.config.json', '-y'])).toBe('harness init --config harness.config.json -y');
  });
});
