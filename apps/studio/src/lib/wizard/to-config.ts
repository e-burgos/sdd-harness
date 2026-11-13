import type { ConfigCatalog } from '@sdd-studio/protocol';
import { acceptsShell, MFE_SHELL_TYPE, supportsMl, supportsTucuUi } from './catalog';
import { effectiveNxVersion, effectiveProfile, type WizardApp, type WizardState } from './state';

export type HarnessConfigDraft = {
  mode?: 'nx' | 'standalone';
  nx?: { version: number };
  project: { name: string; description: string; packageScope: string };
  apps: Array<{ name: string; type: string; port?: number; tucuUi?: false; ml?: true; shell?: string }>;
  libs?: Array<{ name: string; type: string }>;
  services?: Array<{ type: string }>;
  sdd: { profile: 'team' | 'solo'; author?: string; modules?: string[] };
};

const explicitPort = (text: string): number | undefined => {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
};

function toAppConfig(app: WizardApp, state: WizardState, catalog: ConfigCatalog): HarnessConfigDraft['apps'][number] {
  const shellCount = state.apps.filter((candidate) => candidate.type === MFE_SHELL_TYPE).length;
  const port = explicitPort(app.portText);
  return {
    name: app.name,
    type: app.type,
    ...(port !== undefined ? { port } : {}),
    ...(supportsTucuUi(catalog, app.type) && !app.tucuUi ? { tucuUi: false as const } : {}),
    ...(supportsMl(catalog, app.type) && app.ml ? { ml: true as const } : {}),
    ...(acceptsShell(catalog, app.type) && shellCount > 1 && app.shell !== null ? { shell: app.shell } : {}),
  };
}

export function toHarnessConfig(state: WizardState, catalog: ConfigCatalog): HarnessConfigDraft {
  const author = state.author.trim();
  const nxVersion = effectiveNxVersion(state, catalog);
  return {
    ...(state.mode !== null ? { mode: state.mode } : {}),
    ...(nxVersion !== null ? { nx: { version: nxVersion } } : {}),
    project: {
      name: state.project.name,
      description: state.project.description.trim(),
      packageScope: state.project.packageScope,
    },
    apps: state.apps.map((app) => toAppConfig(app, state, catalog)),
    ...(state.libs.length > 0 ? { libs: state.libs.map((lib) => ({ name: lib.name, type: lib.type })) } : {}),
    ...(state.services.length > 0 ? { services: state.services.map((type) => ({ type })) } : {}),
    sdd: {
      profile: effectiveProfile(state),
      ...(author !== '' ? { author } : {}),
      ...(state.modules.length > 0 ? { modules: [...state.modules] } : {}),
    },
  };
}
