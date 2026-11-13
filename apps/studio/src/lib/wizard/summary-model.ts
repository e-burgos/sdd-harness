import type { ConfigCatalog, ResolvedConfig } from '@sdd-studio/protocol';
import { appTypeEntry, stackDescription } from './catalog';
import { explicitPortOf } from './field-checks';
import { effectiveNxVersion, effectiveProfile, type WizardProfile, type WizardState } from './state';

export type PortSource = 'explicit' | 'default' | 'shifted';

export interface SummaryApp {
  name: string;
  type: string;
  stack: string;
  port: number | null;
  portSource: PortSource | null;
  tucuUi: boolean | null;
  shell: string | null;
  route: string | null;
}

export interface SummaryService {
  type: string;
  label: string;
  port: number;
}

export interface SummaryModel {
  mode: 'nx' | 'standalone' | null;
  nxVersion: string | null;
  profile: WizardProfile;
  apps: SummaryApp[];
  libs: Array<{ name: string; type: string }>;
  services: SummaryService[];
  resolved: boolean;
}

export function summaryModel(state: WizardState, catalog: ConfigCatalog, resolved: ResolvedConfig | null): SummaryModel {
  const apps = state.apps.map((app, index): SummaryApp => {
    const entry = appTypeEntry(catalog, app.type);
    const fromResolved = resolved?.apps[index];
    const explicit = explicitPortOf(app, catalog);
    return {
      name: app.name,
      type: app.type,
      stack: fromResolved?.stack ?? (entry ? stackDescription(entry, false) : app.type),
      port: fromResolved?.port ?? explicit,
      portSource: fromResolved?.portSource ?? (explicit !== null ? 'explicit' : null),
      tucuUi: fromResolved ? fromResolved.tucuUi : entry?.tucuUi ? app.tucuUi : null,
      shell: fromResolved?.shell ?? (entry?.shell ? app.shell : null),
      route: fromResolved?.route ?? null,
    };
  });
  const services = state.services.map((type, index): SummaryService => {
    const entry = catalog.serviceTypes.find((candidate) => candidate.type === type);
    return { type, label: entry?.label ?? type, port: resolved?.services[index]?.port ?? entry?.defaultPort ?? 0 };
  });
  const nxMajor = effectiveNxVersion(state, catalog);
  return {
    mode: state.mode,
    nxVersion: nxMajor === null ? null : (catalog.nx?.versions[String(nxMajor)] ?? String(nxMajor)),
    profile: resolved?.profile ?? effectiveProfile(state),
    apps,
    libs: state.libs.map((lib) => ({ name: lib.name, type: lib.type })),
    services,
    resolved: resolved !== null,
  };
}

export const initCommand = (initArgv: readonly string[]): string => ['harness', ...initArgv].join(' ');
