import { applyChange, canAddApp, effectiveNxVersion, effectiveProfile, initialWizardState, planDiscards, stepApplies, visibleSteps } from '../state';
import { catalogFixture, idOf, nxCatalogFixture, run, scoped } from './fixtures';

describe('scope matrix', () => {
  it.each([
    ['fullstack', ['scope', 'shape', 'front', 'back', 'extras', 'summary']],
    ['front', ['scope', 'shape', 'front', 'extras', 'summary']],
    ['back', ['scope', 'shape', 'back', 'extras', 'summary']],
  ] as const)('shows the right steps for %s', (scope, steps) => {
    expect(visibleSteps(scope)).toEqual(steps);
  });

  it('shows everything before a scope is chosen', () => {
    expect(visibleSteps(null)).toHaveLength(6);
    expect(stepApplies('front', 'back')).toBe(false);
    expect(stepApplies('back', 'front')).toBe(false);
  });
});

describe('mode and scope compatibility', () => {
  it('blocks standalone for full stack without discarding anything', () => {
    const state = run([{ type: 'change', change: { type: 'scope', scope: 'fullstack' } }]);
    const plan = planDiscards(state, { type: 'mode', mode: 'standalone' }, catalogFixture);
    expect(plan).toEqual({ blocked: 'fullstack-needs-nx', items: [] });
    expect(applyChange(state, { type: 'mode', mode: 'standalone' }, catalogFixture)).toBe(state);
  });

  it('discards the mode when switching to full stack from standalone', () => {
    const state = scoped('front', 'standalone');
    const plan = planDiscards(state, { type: 'scope', scope: 'fullstack' }, catalogFixture);
    expect(plan.items).toEqual([{ kind: 'mode', mode: 'standalone', reason: 'scope-needs-nx' }]);
    const next = applyChange(state, { type: 'scope', scope: 'fullstack' }, catalogFixture);
    expect(next.mode).toBeNull();
    expect(next.scope).toBe('fullstack');
  });
});

describe('planDiscards by scope', () => {
  const full = run([
    { type: 'change', change: { type: 'scope', scope: 'fullstack' } },
    { type: 'change', change: { type: 'mode', mode: 'nx' } },
    { type: 'app-add', appType: 'react' },
    { type: 'app-add', appType: 'nestjs' },
    { type: 'app-add', appType: 'python' },
  ]);

  it('drops the backends when going front only', () => {
    const plan = planDiscards(full, { type: 'scope', scope: 'front' }, catalogFixture);
    expect(plan.items.map((item) => (item.kind === 'app' ? [item.name, item.reason] : item.kind))).toEqual([
      ['api', 'scope-role'],
      ['py-api', 'scope-role'],
    ]);
  });

  it('drops the frontends when going back only', () => {
    const plan = planDiscards(full, { type: 'scope', scope: 'back' }, catalogFixture);
    expect(plan.items).toEqual([{ kind: 'app', id: idOf(full, 'web'), name: 'web', appType: 'react', reason: 'scope-role' }]);
  });

  it('discards nothing when the change keeps everything compatible', () => {
    expect(planDiscards(full, { type: 'scope', scope: 'fullstack' }, catalogFixture).items).toEqual([]);
  });

  it('stashes the dropped apps and restores them when returning to full stack', () => {
    const front = applyChange(full, { type: 'scope', scope: 'front' }, catalogFixture);
    expect(front.apps.map((a) => a.name)).toEqual(['web']);
    expect(front.stash.apps.map((a) => a.name)).toEqual(['api', 'py-api']);
    const back = applyChange(front, { type: 'scope', scope: 'fullstack' }, catalogFixture);
    expect(back.apps.map((a) => a.name)).toEqual(['web', 'api', 'py-api']);
    expect(back.stash.apps).toEqual([]);
  });

  it('does not restore stashed apps that no longer fit the mode', () => {
    const front = applyChange(full, { type: 'scope', scope: 'front' }, catalogFixture);
    const standalone = applyChange(front, { type: 'mode', mode: 'standalone' }, catalogFixture);
    const backOnly = applyChange(standalone, { type: 'scope', scope: 'back' }, catalogFixture);
    expect(backOnly.apps).toHaveLength(1);
    expect(backOnly.apps[0].role).toBe('backend');
    expect(backOnly.stash.apps.some((a) => a.role === 'frontend')).toBe(true);
  });
});

describe('planDiscards by mode', () => {
  const monorepo = run([
    { type: 'change', change: { type: 'scope', scope: 'front' } },
    { type: 'change', change: { type: 'mode', mode: 'nx' } },
    { type: 'app-add', appType: 'mfe-shell' },
    { type: 'app-add', appType: 'mfe' },
    { type: 'app-add', appType: 'react' },
    { type: 'lib-toggle', libType: 'ui-kit' },
  ]);

  it('lists workspace-only apps, extra apps and libs when going standalone', () => {
    const plan = planDiscards(monorepo, { type: 'mode', mode: 'standalone' }, catalogFixture);
    const summary = plan.items.map((item) => (item.kind === 'app' ? `app:${item.name}:${item.reason}` : item.kind === 'lib' ? `lib:${item.name}` : item.kind));
    expect(summary).toEqual(['app:shell:mode-workspace-only', 'app:mfe:mode-workspace-only', 'lib:ui-kit']);
  });

  it('reports an app over the standalone limit', () => {
    const two = run([
      { type: 'change', change: { type: 'scope', scope: 'front' } },
      { type: 'change', change: { type: 'mode', mode: 'nx' } },
      { type: 'app-add', appType: 'react' },
      { type: 'app-add', appType: 'nextjs' },
    ]);
    const plan = planDiscards(two, { type: 'mode', mode: 'standalone' }, catalogFixture);
    expect(plan.items).toEqual([expect.objectContaining({ kind: 'app', name: 'next-web', reason: 'mode-max-apps' })]);
  });

  it('applies the discards and keeps them stashed', () => {
    const next = applyChange(monorepo, { type: 'mode', mode: 'standalone' }, catalogFixture);
    expect(next.apps.map((a) => a.name)).toEqual(['web']);
    expect(next.libs).toEqual([]);
    expect(next.stash.libs).toEqual([{ type: 'ui-kit', name: 'ui-kit' }]);
  });

  it('cleans the shell link of an mfe whose shell is discarded', () => {
    const withShell = run([
      { type: 'change', change: { type: 'scope', scope: 'front' } },
      { type: 'change', change: { type: 'mode', mode: 'nx' } },
      { type: 'app-add', appType: 'react' },
      { type: 'app-add', appType: 'mfe-shell' },
      { type: 'app-add', appType: 'mfe' },
    ]);
    const linked = run([{ type: 'app-set', id: idOf(withShell, 'mfe'), patch: { shell: 'shell' } }], withShell);
    const plan = planDiscards(linked, { type: 'mode', mode: 'standalone' }, catalogFixture);
    expect(plan.items.filter((i) => i.kind === 'shell-link')).toEqual([]);
    const cleaned = applyChange({ ...linked, apps: linked.apps.filter((a) => a.type !== 'mfe') }, { type: 'mode', mode: 'standalone' }, catalogFixture);
    expect(cleaned.apps.map((a) => a.name)).toEqual(['web']);
  });
});

describe('app editing', () => {
  it('refuses a second app in standalone and explains why', () => {
    const state = run([{ type: 'app-add', appType: 'react' }], scoped('front', 'standalone'));
    expect(canAddApp(state, catalogFixture)).toEqual({ ok: false, reason: 'standalone-single-app' });
    expect(run([{ type: 'app-add', appType: 'nextjs' }], state).apps).toHaveLength(1);
  });

  it('refuses workspace-only types in standalone and roles outside the scope', () => {
    const state = scoped('front', 'standalone');
    expect(run([{ type: 'app-add', appType: 'mfe' }], state).apps).toEqual([]);
    expect(run([{ type: 'app-add', appType: 'nestjs' }], state).apps).toEqual([]);
  });

  it('gives unique default names', () => {
    const state = run([
      { type: 'change', change: { type: 'scope', scope: 'back' } },
      { type: 'change', change: { type: 'mode', mode: 'nx' } },
      { type: 'app-add', appType: 'nestjs' },
      { type: 'app-add', appType: 'nestjs' },
    ]);
    expect(state.apps.map((a) => a.name)).toEqual(['api', 'api-2']);
  });

  it('resets flags that the new type does not support', () => {
    let state = run([
      { type: 'change', change: { type: 'scope', scope: 'fullstack' } },
      { type: 'change', change: { type: 'mode', mode: 'nx' } },
      { type: 'app-add', appType: 'python' },
    ]);
    const id = state.apps[0].id;
    state = run([{ type: 'app-set', id, patch: { ml: true } }, { type: 'app-type', id, appType: 'nestjs' }], state);
    expect(state.apps[0]).toMatchObject({ type: 'nestjs', ml: false });
  });

  it('renames shell references when a shell is renamed and clears them when removed', () => {
    let state = run([
      { type: 'change', change: { type: 'scope', scope: 'front' } },
      { type: 'change', change: { type: 'mode', mode: 'nx' } },
      { type: 'app-add', appType: 'mfe-shell' },
      { type: 'app-add', appType: 'mfe' },
    ]);
    const shellId = idOf(state, 'shell');
    state = run([{ type: 'app-set', id: idOf(state, 'mfe'), patch: { shell: 'shell' } }], state);
    state = run([{ type: 'app-set', id: shellId, patch: { name: 'host' } }], state);
    expect(state.apps.find((a) => a.type === 'mfe')?.shell).toBe('host');
    state = run([{ type: 'app-remove', id: shellId }], state);
    expect(state.apps.find((a) => a.type === 'mfe')?.shell).toBeNull();
  });
});

describe('project, libs, services and profile', () => {
  it('derives the package scope from the name until the user edits it', () => {
    let state = run([{ type: 'project', patch: { name: 'mi-proyecto' } }]);
    expect(state.project.packageScope).toBe('@mi-proyecto');
    state = run([{ type: 'project', patch: { packageScope: '@acme' } }, { type: 'project', patch: { name: 'otro' } }], state);
    expect(state.project.packageScope).toBe('@acme');
    state = run([{ type: 'project', patch: { packageScope: '' } }], state);
    expect(state.project.packageScope).toBe('@otro');
  });

  it('only allows libs where the mode allows them', () => {
    expect(run([{ type: 'lib-toggle', libType: 'config' }], scoped('front', 'standalone')).libs).toEqual([]);
    const nx = run([{ type: 'lib-toggle', libType: 'config' }, { type: 'lib-rename', libType: 'config', name: 'cfg' }], scoped('front', 'nx'));
    expect(nx.libs).toEqual([{ type: 'config', name: 'cfg' }]);
    expect(run([{ type: 'lib-toggle', libType: 'config' }], nx).libs).toEqual([]);
  });

  it('defaults the profile by mode and honours an explicit choice', () => {
    expect(effectiveProfile(scoped('front', 'standalone'))).toBe('solo');
    expect(effectiveProfile(scoped('front', 'nx'))).toBe('team');
    expect(effectiveProfile(run([{ type: 'profile', profile: 'team' }], scoped('front', 'standalone')))).toBe('team');
  });

  it('toggles services and resets', () => {
    const state = run([{ type: 'service-toggle', serviceType: 'redis' }, { type: 'service-toggle', serviceType: 'postgres' }, { type: 'service-toggle', serviceType: 'redis' }]);
    expect(state.services).toEqual(['postgres']);
    expect(run([{ type: 'reset' }], state)).toEqual(initialWizardState());
  });
});

describe('nx version', () => {
  it('starts on the catalog default and follows the chosen major', () => {
    const state = scoped('front', 'nx');
    expect(state.nxVersion).toBeNull();
    expect(effectiveNxVersion(state, nxCatalogFixture)).toBe(24);
    expect(effectiveNxVersion(run([{ type: 'nx-version', major: 23 }], state), nxCatalogFixture)).toBe(23);
  });

  it('is absent for standalone and for catalogs without nx', () => {
    expect(effectiveNxVersion(scoped('front', 'standalone'), nxCatalogFixture)).toBeNull();
    expect(effectiveNxVersion(scoped('front', 'nx'), catalogFixture)).toBeNull();
  });
});
