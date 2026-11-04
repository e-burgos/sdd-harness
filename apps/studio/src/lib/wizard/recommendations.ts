import type { ConfigCatalog } from '@sdd-studio/protocol';
import { supportsTucuUi, type WizardMode } from './catalog';
import type { WizardState } from './state';

export type Recommendation =
  | { kind: 'mode'; value: WizardMode; reason: 'fullstack-monorepo' | 'single-side-standalone' }
  | { kind: 'backend'; value: string; reason: 'front-needs-upstream' }
  | { kind: 'lib'; value: string; reason: 'fullstack-shared-types' | 'shared-ui-kit' | 'front-back-client' };

const UPSTREAM_FRONT_TYPES: readonly string[] = ['nextjs', 'next-bff'];
const UPSTREAM_BACKEND = 'nestjs';

function modeRecommendation(state: WizardState): Recommendation[] {
  if (state.scope === null) return [];
  return state.scope === 'fullstack'
    ? [{ kind: 'mode', value: 'nx', reason: 'fullstack-monorepo' }]
    : [{ kind: 'mode', value: 'standalone', reason: 'single-side-standalone' }];
}

function backendRecommendation(state: WizardState): Recommendation[] {
  const needsUpstream = state.apps.some((app) => app.role === 'frontend' && UPSTREAM_FRONT_TYPES.includes(app.type));
  return needsUpstream ? [{ kind: 'backend', value: UPSTREAM_BACKEND, reason: 'front-needs-upstream' }] : [];
}

function libRecommendations(state: WizardState, catalog: ConfigCatalog): Recommendation[] {
  const result: Recommendation[] = [];
  const fronts = state.apps.filter((app) => app.role === 'frontend');
  const backs = state.apps.filter((app) => app.role === 'backend');
  if (state.scope === 'fullstack') result.push({ kind: 'lib', value: 'shared-types', reason: 'fullstack-shared-types' });
  if (fronts.length > 1 && fronts.some((app) => supportsTucuUi(catalog, app.type) && app.tucuUi)) {
    result.push({ kind: 'lib', value: 'ui-kit', reason: 'shared-ui-kit' });
  }
  if (fronts.length > 0 && backs.length > 0) result.push({ kind: 'lib', value: 'api-client', reason: 'front-back-client' });
  return result;
}

export const recommendationsFor = (state: WizardState, catalog: ConfigCatalog): Recommendation[] => [
  ...modeRecommendation(state),
  ...backendRecommendation(state),
  ...libRecommendations(state, catalog),
];

export const isRecommended = (list: readonly Recommendation[], kind: Recommendation['kind'], value: string): boolean =>
  list.some((item) => item.kind === kind && item.value === value);
