import { toHarnessConfig } from '../to-config';
import { catalogFixture, idOf, nxCatalogFixture, run, scoped } from './fixtures';

const named = (state: ReturnType<typeof scoped>) =>
  run([{ type: 'project', patch: { name: 'demo', description: ' Demo project ' } }], state);

describe('toHarnessConfig', () => {
  it('emits only what was decided and always the profile', () => {
    const state = named(run([{ type: 'app-add', appType: 'react' }, { type: 'app-add', appType: 'nestjs' }], scoped('fullstack', 'nx')));
    expect(toHarnessConfig(state, catalogFixture)).toEqual({
      mode: 'nx',
      project: { name: 'demo', description: 'Demo project', packageScope: '@demo' },
      apps: [
        { name: 'web', type: 'react' },
        { name: 'api', type: 'nestjs' },
      ],
      sdd: { profile: 'team' },
    });
  });

  it('writes tucuUi false only when it was turned off', () => {
    let state = named(run([{ type: 'app-add', appType: 'react' }], scoped('front', 'nx')));
    expect(toHarnessConfig(state, catalogFixture).apps[0]).not.toHaveProperty('tucuUi');
    state = run([{ type: 'app-set', id: state.apps[0].id, patch: { tucuUi: false } }], state);
    expect(toHarnessConfig(state, catalogFixture).apps[0]).toEqual({ name: 'web', type: 'react', tucuUi: false });
  });

  it('does not write tucuUi for a type without the toggle', () => {
    let state = named(run([{ type: 'app-add', appType: 'nestjs' }], scoped('back', 'nx')));
    state = run([{ type: 'app-set', id: state.apps[0].id, patch: { tucuUi: false } }], state);
    expect(toHarnessConfig(state, catalogFixture).apps[0]).not.toHaveProperty('tucuUi');
  });

  it('writes port only when edited and numeric', () => {
    let state = named(run([{ type: 'app-add', appType: 'react' }], scoped('front', 'nx')));
    const id = state.apps[0].id;
    expect(toHarnessConfig(state, catalogFixture).apps[0]).not.toHaveProperty('port');
    state = run([{ type: 'app-set', id, patch: { portText: ' 3100 ' } }], state);
    expect(toHarnessConfig(state, catalogFixture).apps[0].port).toBe(3100);
    state = run([{ type: 'app-set', id, patch: { portText: 'abc' } }], state);
    expect(toHarnessConfig(state, catalogFixture).apps[0]).not.toHaveProperty('port');
    state = run([{ type: 'app-set', id, patch: { portText: '' } }], state);
    expect(toHarnessConfig(state, catalogFixture).apps[0]).not.toHaveProperty('port');
  });

  it('writes ml only for python with the switch on', () => {
    let state = named(run([{ type: 'app-add', appType: 'python' }, { type: 'app-add', appType: 'nestjs' }], scoped('back', 'nx')));
    state = run([{ type: 'app-set', id: idOf(state, 'api'), patch: { ml: true } }], state);
    expect(toHarnessConfig(state, catalogFixture).apps.every((a) => !('ml' in a))).toBe(true);
    state = run([{ type: 'app-set', id: idOf(state, 'py-api'), patch: { ml: true } }], state);
    expect(toHarnessConfig(state, catalogFixture).apps[0]).toEqual({ name: 'py-api', type: 'python', ml: true });
  });

  describe('shell', () => {
    const base = () =>
      named(run([{ type: 'app-add', appType: 'mfe-shell' }, { type: 'app-add', appType: 'mfe' }], scoped('front', 'nx')));

    it('is omitted with a single mfe-shell', () => {
      let state = base();
      state = run([{ type: 'app-set', id: idOf(state, 'mfe'), patch: { shell: 'shell' } }], state);
      expect(toHarnessConfig(state, catalogFixture).apps.find((a) => a.type === 'mfe')).toEqual({ name: 'mfe', type: 'mfe' });
    });

    it('is written with more than one mfe-shell', () => {
      let state = run([{ type: 'app-add', appType: 'mfe-shell' }], base());
      state = run([{ type: 'app-set', id: idOf(state, 'mfe'), patch: { shell: 'shell-2' } }], state);
      expect(toHarnessConfig(state, catalogFixture).apps.find((a) => a.type === 'mfe')).toEqual({ name: 'mfe', type: 'mfe', shell: 'shell-2' });
    });
  });

  it('writes libs, services, author and modules only when defined', () => {
    let state = named(run([{ type: 'app-add', appType: 'react' }], scoped('front', 'nx')));
    const config = toHarnessConfig(state, catalogFixture);
    expect(config).not.toHaveProperty('libs');
    expect(config).not.toHaveProperty('services');
    expect(config.sdd).toEqual({ profile: 'team' });
    state = run(
      [
        { type: 'lib-toggle', libType: 'shared-types' },
        { type: 'service-toggle', serviceType: 'postgres' },
        { type: 'author', author: ' jdoe ' },
        { type: 'modules', modules: ['billing'] },
        { type: 'profile', profile: 'solo' },
      ],
      state,
    );
    const full = toHarnessConfig(state, catalogFixture);
    expect(full.libs).toEqual([{ name: 'shared-types', type: 'shared-types' }]);
    expect(full.services).toEqual([{ type: 'postgres' }]);
    expect(full.sdd).toEqual({ profile: 'solo', author: 'jdoe', modules: ['billing'] });
  });

  it('omits the mode until it is chosen', () => {
    expect(toHarnessConfig(named(run([])), catalogFixture)).not.toHaveProperty('mode');
  });

  describe('nx version', () => {
    const monorepo = () => named(run([{ type: 'app-add', appType: 'react' }], scoped('front', 'nx')));

    it('writes the catalog default for a monorepo when nothing was chosen', () => {
      expect(toHarnessConfig(monorepo(), nxCatalogFixture).nx).toEqual({ version: 24 });
    });

    it('writes the chosen major', () => {
      const state = run([{ type: 'nx-version', major: 22 }], monorepo());
      expect(toHarnessConfig(state, nxCatalogFixture).nx).toEqual({ version: 22 });
    });

    it('falls back to the default when the chosen major left the catalog', () => {
      const state = run([{ type: 'nx-version', major: 19 }], monorepo());
      expect(toHarnessConfig(state, nxCatalogFixture).nx).toEqual({ version: 24 });
    });

    it('writes nothing for standalone', () => {
      const state = named(run([{ type: 'app-add', appType: 'react' }], scoped('front', 'standalone')));
      expect(toHarnessConfig(state, nxCatalogFixture)).not.toHaveProperty('nx');
    });

    it('writes nothing when the catalog has no nx', () => {
      expect(toHarnessConfig(monorepo(), catalogFixture)).not.toHaveProperty('nx');
    });
  });
});
