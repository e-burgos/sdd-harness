import { isRecommended, recommendationsFor } from '../recommendations';
import { catalogFixture, idOf, run, scoped } from './fixtures';

describe('recommendations', () => {
  it('recommends the mode by scope without choosing it', () => {
    const full = run([{ type: 'change', change: { type: 'scope', scope: 'fullstack' } }]);
    expect(isRecommended(recommendationsFor(full, catalogFixture), 'mode', 'nx')).toBe(true);
    expect(full.mode).toBeNull();
    const back = run([{ type: 'change', change: { type: 'scope', scope: 'back' } }]);
    expect(isRecommended(recommendationsFor(back, catalogFixture), 'mode', 'standalone')).toBe(true);
    expect(recommendationsFor(run([]), catalogFixture)).toEqual([]);
  });

  it('recommends nestjs when the front needs an upstream, and never preselects', () => {
    const state = run([{ type: 'app-add', appType: 'next-bff' }], scoped('fullstack', 'nx'));
    expect(isRecommended(recommendationsFor(state, catalogFixture), 'backend', 'nestjs')).toBe(true);
    expect(state.apps.some((app) => app.role === 'backend')).toBe(false);
    const spa = run([{ type: 'app-add', appType: 'react' }], scoped('fullstack', 'nx'));
    expect(isRecommended(recommendationsFor(spa, catalogFixture), 'backend', 'nestjs')).toBe(false);
  });

  it('recommends shared-types for full stack and api-client for front plus back', () => {
    const state = run([{ type: 'app-add', appType: 'react' }, { type: 'app-add', appType: 'nestjs' }], scoped('fullstack', 'nx'));
    const list = recommendationsFor(state, catalogFixture);
    expect(isRecommended(list, 'lib', 'shared-types')).toBe(true);
    expect(isRecommended(list, 'lib', 'api-client')).toBe(true);
    expect(isRecommended(list, 'lib', 'ui-kit')).toBe(false);
    expect(state.libs).toEqual([]);
  });

  it('recommends ui-kit only with several fronts and some with tucu-ui', () => {
    let state = run([{ type: 'app-add', appType: 'react' }, { type: 'app-add', appType: 'nextjs' }], scoped('front', 'nx'));
    expect(isRecommended(recommendationsFor(state, catalogFixture), 'lib', 'ui-kit')).toBe(true);
    state = run([
      { type: 'app-set', id: idOf(state, 'web'), patch: { tucuUi: false } },
      { type: 'app-set', id: idOf(state, 'next-web'), patch: { tucuUi: false } },
    ], state);
    expect(isRecommended(recommendationsFor(state, catalogFixture), 'lib', 'ui-kit')).toBe(false);
    const single = run([{ type: 'app-add', appType: 'react' }], scoped('front', 'nx'));
    expect(isRecommended(recommendationsFor(single, catalogFixture), 'lib', 'ui-kit')).toBe(false);
  });
});
