import type { ConfigCatalog } from '@sdd-studio/protocol';
import {
  appTypeEntry,
  libsAllowed,
  maxAppsFor,
  modeAllowsScope,
  supportsMl,
  supportsTucuUi,
  typeBlockReason,
  type AppRole,
  type WizardMode,
  type WizardScope,
} from './catalog';

export type WizardProfile = 'team' | 'solo';
export type WizardStepId = 'scope' | 'shape' | 'front' | 'back' | 'extras' | 'summary';

export const WIZARD_STEPS: readonly WizardStepId[] = ['scope', 'shape', 'front', 'back', 'extras', 'summary'];

export interface WizardApp {
  id: string;
  type: string;
  role: AppRole;
  name: string;
  portText: string;
  tucuUi: boolean;
  ml: boolean;
  shell: string | null;
}

export interface WizardLib {
  type: string;
  name: string;
}

export interface WizardProject {
  name: string;
  description: string;
  packageScope: string;
  packageScopeTouched: boolean;
}

export interface WizardStash {
  apps: WizardApp[];
  libs: WizardLib[];
}

export interface WizardState {
  scope: WizardScope | null;
  mode: WizardMode | null;
  project: WizardProject;
  apps: WizardApp[];
  libs: WizardLib[];
  services: string[];
  profile: WizardProfile | null;
  author: string;
  modules: string[];
  nxVersion: number | null;
  nextAppId: number;
  stash: WizardStash;
}

export type WizardChange = { type: 'scope'; scope: WizardScope } | { type: 'mode'; mode: WizardMode };

export type DiscardReason = 'scope-role' | 'mode-workspace-only' | 'mode-max-apps' | 'mode-no-libs' | 'scope-needs-nx';

export type DiscardItem =
  | { kind: 'app'; id: string; name: string; appType: string; reason: DiscardReason }
  | { kind: 'lib'; name: string; libType: string; reason: DiscardReason }
  | { kind: 'mode'; mode: WizardMode; reason: DiscardReason }
  | { kind: 'shell-link'; appName: string; shell: string };

export interface DiscardPlan {
  blocked: 'fullstack-needs-nx' | null;
  items: DiscardItem[];
}

export type WizardAction =
  | { type: 'change'; change: WizardChange }
  | { type: 'project'; patch: Partial<Pick<WizardProject, 'name' | 'description' | 'packageScope'>> }
  | { type: 'app-add'; appType: string; name?: string }
  | { type: 'app-set'; id: string; patch: Partial<Pick<WizardApp, 'name' | 'portText' | 'tucuUi' | 'ml' | 'shell'>> }
  | { type: 'app-type'; id: string; appType: string }
  | { type: 'app-remove'; id: string }
  | { type: 'lib-toggle'; libType: string }
  | { type: 'lib-rename'; libType: string; name: string }
  | { type: 'service-toggle'; serviceType: string }
  | { type: 'profile'; profile: WizardProfile | null }
  | { type: 'author'; author: string }
  | { type: 'modules'; modules: string[] }
  | { type: 'nx-version'; major: number | null }
  | { type: 'reset' };

export const initialWizardState = (): WizardState => ({
  scope: null,
  mode: null,
  project: { name: '', description: '', packageScope: '', packageScopeTouched: false },
  apps: [],
  libs: [],
  services: [],
  profile: null,
  author: '',
  modules: [],
  nxVersion: null,
  nextAppId: 1,
  stash: { apps: [], libs: [] },
});

export const isInitialState = (state: WizardState): boolean =>
  JSON.stringify({ ...state, nextAppId: 0 }) === JSON.stringify({ ...initialWizardState(), nextAppId: 0 });

export const roleInScope = (scope: WizardScope | null, role: AppRole): boolean =>
  scope === null || scope === 'fullstack' || (scope === 'front' ? role === 'frontend' : role === 'backend');

export const stepApplies = (scope: WizardScope | null, step: WizardStepId): boolean => {
  if (step === 'front') return roleInScope(scope, 'frontend');
  if (step === 'back') return roleInScope(scope, 'backend');
  return true;
};

export const visibleSteps = (scope: WizardScope | null): WizardStepId[] => WIZARD_STEPS.filter((step) => stepApplies(scope, step));

export const effectiveProfile = (state: WizardState): WizardProfile => state.profile ?? (state.mode === 'standalone' ? 'solo' : 'team');

export function effectiveNxVersion(state: WizardState, catalog: ConfigCatalog): number | null {
  if (!catalog.nx || state.mode !== 'nx') return null;
  return state.nxVersion !== null && catalog.nx.majors.includes(state.nxVersion) ? state.nxVersion : catalog.nx.default;
}

export const derivedPackageScope = (name: string): string => (name === '' ? '' : `@${name}`);

function incompatibleWith(
  catalog: ConfigCatalog,
  scope: WizardScope | null,
  mode: WizardMode | null,
  app: WizardApp,
): DiscardReason | null {
  if (!roleInScope(scope, app.role)) return 'scope-role';
  const entry = appTypeEntry(catalog, app.type);
  if (entry && typeBlockReason(catalog, entry, mode) !== null) return 'mode-workspace-only';
  return null;
}

export function planDiscards(state: WizardState, change: WizardChange, catalog: ConfigCatalog): DiscardPlan {
  const scope = change.type === 'scope' ? change.scope : state.scope;
  const mode = change.type === 'mode' ? change.mode : state.mode;
  if (change.type === 'mode' && scope !== null && !modeAllowsScope(catalog, change.mode, scope)) {
    return { blocked: 'fullstack-needs-nx', items: [] };
  }
  const items: DiscardItem[] = [];
  if (change.type === 'scope' && mode !== null && !modeAllowsScope(catalog, mode, change.scope)) {
    items.push({ kind: 'mode', mode, reason: 'scope-needs-nx' });
  }
  const effectiveMode = items.some((item) => item.kind === 'mode') ? null : mode;
  const discardedApps = new Set<string>();
  for (const app of state.apps) {
    const reason = incompatibleWith(catalog, scope, effectiveMode, app);
    if (reason) {
      discardedApps.add(app.id);
      items.push({ kind: 'app', id: app.id, name: app.name, appType: app.type, reason });
    }
  }
  const max = maxAppsFor(catalog, effectiveMode);
  if (max !== null) {
    const kept = state.apps.filter((app) => !discardedApps.has(app.id));
    for (const app of kept.slice(max)) {
      discardedApps.add(app.id);
      items.push({ kind: 'app', id: app.id, name: app.name, appType: app.type, reason: 'mode-max-apps' });
    }
  }
  if (effectiveMode !== null && !libsAllowed(catalog, effectiveMode)) {
    for (const lib of state.libs) items.push({ kind: 'lib', name: lib.name, libType: lib.type, reason: 'mode-no-libs' });
  }
  const discardedShells = new Set(
    state.apps.filter((app) => discardedApps.has(app.id)).map((app) => app.name),
  );
  for (const app of state.apps) {
    if (!discardedApps.has(app.id) && app.shell !== null && discardedShells.has(app.shell)) {
      items.push({ kind: 'shell-link', appName: app.name, shell: app.shell });
    }
  }
  return { blocked: null, items };
}

const withoutIds = (apps: WizardApp[], ids: Set<string>): WizardApp[] => apps.filter((app) => !ids.has(app.id));

function restoreFromStash(state: WizardState, catalog: ConfigCatalog): WizardState {
  const max = maxAppsFor(catalog, state.mode);
  const restorable: WizardApp[] = [];
  const remaining: WizardApp[] = [];
  let count = state.apps.length;
  for (const app of state.stash.apps) {
    const fits = incompatibleWith(catalog, state.scope, state.mode, app) === null && (max === null || count < max);
    if (fits) {
      restorable.push(app);
      count += 1;
    } else {
      remaining.push(app);
    }
  }
  const libs = libsAllowed(catalog, state.mode) ? state.stash.libs : [];
  const restoredLibs = libs.filter((lib) => !state.libs.some((existing) => existing.type === lib.type));
  const remainingLibs = state.stash.libs.filter((lib) => !restoredLibs.includes(lib));
  if (restorable.length === 0 && restoredLibs.length === 0) return state;
  return {
    ...state,
    apps: [...state.apps, ...restorable],
    libs: [...state.libs, ...restoredLibs],
    stash: { apps: remaining, libs: remainingLibs },
  };
}

export type AddAppBlock = 'standalone-single-app';

export function canAddApp(state: WizardState, catalog: ConfigCatalog): { ok: true } | { ok: false; reason: AddAppBlock } {
  const max = maxAppsFor(catalog, state.mode);
  if (max !== null && state.apps.length >= max) return { ok: false, reason: 'standalone-single-app' };
  return { ok: true };
}

export function applyChange(state: WizardState, change: WizardChange, catalog: ConfigCatalog): WizardState {
  const plan = planDiscards(state, change, catalog);
  if (plan.blocked) return state;
  const droppedIds = new Set(plan.items.flatMap((item) => (item.kind === 'app' ? [item.id] : [])));
  const droppedLibs = plan.items.some((item) => item.kind === 'lib');
  const droppedMode = plan.items.some((item) => item.kind === 'mode');
  const droppedNames = new Set(state.apps.filter((app) => droppedIds.has(app.id)).map((app) => app.name));
  const stashedApps = state.apps.filter((app) => droppedIds.has(app.id));
  const survivors = withoutIds(state.apps, droppedIds).map((app) =>
    app.shell !== null && droppedNames.has(app.shell) ? { ...app, shell: null } : app,
  );
  const next: WizardState = {
    ...state,
    scope: change.type === 'scope' ? change.scope : state.scope,
    mode: change.type === 'mode' ? change.mode : droppedMode ? null : state.mode,
    apps: survivors,
    libs: droppedLibs ? [] : state.libs,
    stash: {
      apps: [...state.stash.apps, ...stashedApps],
      libs: droppedLibs ? [...state.stash.libs, ...state.libs] : state.stash.libs,
    },
  };
  return restoreFromStash(next, catalog);
}

function uniqueName(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function addApp(state: WizardState, catalog: ConfigCatalog, appType: string, name?: string): WizardState {
  const entry = appTypeEntry(catalog, appType);
  if (!entry || !roleInScope(state.scope, entry.role)) return state;
  if (typeBlockReason(catalog, entry, state.mode) !== null) return state;
  const max = maxAppsFor(catalog, state.mode);
  if (max !== null && state.apps.length >= max) return state;
  const taken = state.apps.map((app) => app.name);
  const app: WizardApp = {
    id: `app-${state.nextAppId}`,
    type: appType,
    role: entry.role,
    name: name ?? uniqueName(entry.defaultName, taken),
    portText: '',
    tucuUi: true,
    ml: false,
    shell: null,
  };
  return { ...state, apps: [...state.apps, app], nextAppId: state.nextAppId + 1 };
}

function retypeApp(state: WizardState, catalog: ConfigCatalog, id: string, appType: string): WizardState {
  const entry = appTypeEntry(catalog, appType);
  if (!entry) return state;
  if (typeBlockReason(catalog, entry, state.mode) !== null) return state;
  return {
    ...state,
    apps: state.apps.map((app) =>
      app.id !== id
        ? app
        : {
            ...app,
            type: appType,
            role: entry.role,
            tucuUi: supportsTucuUi(catalog, appType) ? app.tucuUi : true,
            ml: supportsMl(catalog, appType) ? app.ml : false,
            shell: entry.shell ? app.shell : null,
          },
    ),
  };
}

function removeApp(state: WizardState, id: string): WizardState {
  const removed = state.apps.find((app) => app.id === id);
  if (!removed) return state;
  return {
    ...state,
    apps: state.apps
      .filter((app) => app.id !== id)
      .map((app) => (app.shell === removed.name ? { ...app, shell: null } : app)),
  };
}

function setApp(state: WizardState, id: string, patch: Partial<WizardApp>): WizardState {
  const target = state.apps.find((app) => app.id === id);
  if (!target) return state;
  const renamed = patch.name !== undefined && patch.name !== target.name;
  return {
    ...state,
    apps: state.apps.map((app) => {
      if (app.id === id) return { ...app, ...patch };
      return renamed && app.shell === target.name ? { ...app, shell: patch.name as string } : app;
    }),
  };
}

function patchProject(state: WizardState, patch: Partial<WizardProject>): WizardState {
  const project = { ...state.project, ...patch };
  if (patch.packageScope !== undefined) {
    project.packageScopeTouched = patch.packageScope !== '';
  }
  if (!project.packageScopeTouched) project.packageScope = derivedPackageScope(project.name);
  return { ...state, project };
}

function toggleLib(state: WizardState, libType: string): WizardState {
  return state.libs.some((lib) => lib.type === libType)
    ? { ...state, libs: state.libs.filter((lib) => lib.type !== libType) }
    : { ...state, libs: [...state.libs, { type: libType, name: libType }] };
}

export function wizardReducer(state: WizardState, action: WizardAction, catalog: ConfigCatalog): WizardState {
  switch (action.type) {
    case 'change':
      return applyChange(state, action.change, catalog);
    case 'project':
      return patchProject(state, action.patch);
    case 'app-add':
      return addApp(state, catalog, action.appType, action.name);
    case 'app-set':
      return setApp(state, action.id, action.patch);
    case 'app-type':
      return retypeApp(state, catalog, action.id, action.appType);
    case 'app-remove':
      return removeApp(state, action.id);
    case 'lib-toggle':
      return libsAllowed(catalog, state.mode) ? toggleLib(state, action.libType) : state;
    case 'lib-rename':
      return { ...state, libs: state.libs.map((lib) => (lib.type === action.libType ? { ...lib, name: action.name } : lib)) };
    case 'service-toggle':
      return {
        ...state,
        services: state.services.includes(action.serviceType)
          ? state.services.filter((type) => type !== action.serviceType)
          : [...state.services, action.serviceType],
      };
    case 'profile':
      return { ...state, profile: action.profile };
    case 'author':
      return { ...state, author: action.author };
    case 'modules':
      return { ...state, modules: action.modules };
    case 'nx-version':
      return { ...state, nxVersion: action.major };
    case 'reset':
      return initialWizardState();
  }
}
