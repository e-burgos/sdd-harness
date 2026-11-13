import type { ConfigCatalog } from '@sdd-studio/protocol';

export type WizardMode = 'nx' | 'standalone';
export type WizardScope = 'fullstack' | 'front' | 'back';
export type AppRole = 'frontend' | 'backend';
export type CatalogAppType = ConfigCatalog['appTypes'][number];
export type CatalogMode = ConfigCatalog['modes'][number];

export const MFE_SHELL_TYPE = 'mfe-shell';

export type BlockReason = 'workspace-only' | 'fullstack-needs-nx';

export interface TypeOption {
  type: string;
  entry: CatalogAppType;
  blocked: BlockReason | null;
}

export interface BackendFamily {
  id: 'node' | 'python' | 'java';
  types: readonly string[];
  useCase: 'streaming-devices' | 'cpu-heavy-ai' | 'enterprise-jvm';
}

export const BACKEND_FAMILIES: readonly BackendFamily[] = [
  { id: 'node', types: ['nestjs', 'fastify', 'hono'], useCase: 'streaming-devices' },
  { id: 'python', types: ['python'], useCase: 'cpu-heavy-ai' },
  { id: 'java', types: ['springboot'], useCase: 'enterprise-jvm' },
];

export const modeEntry = (catalog: ConfigCatalog, mode: WizardMode): CatalogMode | undefined =>
  catalog.modes.find((entry) => entry.mode === mode);

export const appTypeEntry = (catalog: ConfigCatalog, type: string): CatalogAppType | undefined =>
  catalog.appTypes.find((entry) => entry.type === type);

export const maxAppsFor = (catalog: ConfigCatalog, mode: WizardMode | null): number | null =>
  mode === null ? null : (modeEntry(catalog, mode)?.maxApps ?? null);

export const libsAllowed = (catalog: ConfigCatalog, mode: WizardMode | null): boolean =>
  mode === null ? false : (modeEntry(catalog, mode)?.libs ?? false);

export const modeAllowsScope = (catalog: ConfigCatalog, mode: WizardMode, scope: WizardScope): boolean => {
  if (scope !== 'fullstack') return true;
  const max = maxAppsFor(catalog, mode);
  return max === null || max >= 2;
};

export const modeBlockReason = (catalog: ConfigCatalog, mode: WizardMode, scope: WizardScope | null): BlockReason | null =>
  scope !== null && !modeAllowsScope(catalog, mode, scope) ? 'fullstack-needs-nx' : null;

export const typeBlockReason = (_catalog: ConfigCatalog, entry: CatalogAppType, mode: WizardMode | null): BlockReason | null =>
  mode === 'standalone' && entry.workspaceOnly ? 'workspace-only' : null;

export function typeOptions(catalog: ConfigCatalog, mode: WizardMode | null, role: AppRole): TypeOption[] {
  return catalog.appTypes
    .filter((entry) => entry.role === role)
    .map((entry) => ({ type: entry.type, entry, blocked: typeBlockReason(catalog, entry, mode) }));
}

export const typesOfRole = (catalog: ConfigCatalog, role: AppRole): string[] =>
  catalog.appTypes.filter((entry) => entry.role === role).map((entry) => entry.type);

export const supportsTucuUi = (catalog: ConfigCatalog, type: string): boolean => appTypeEntry(catalog, type)?.tucuUi ?? false;
export const supportsMl = (catalog: ConfigCatalog, type: string): boolean => appTypeEntry(catalog, type)?.ml ?? false;
export const acceptsShell = (catalog: ConfigCatalog, type: string): boolean => appTypeEntry(catalog, type)?.shell ?? false;

export interface NxChoice {
  major: number;
  version: string;
  recommended: boolean;
}

export const nxChoices = (catalog: ConfigCatalog): NxChoice[] =>
  (catalog.nx?.majors ?? []).map((major) => ({
    major,
    version: catalog.nx?.versions[String(major)] ?? String(major),
    recommended: major === catalog.nx?.default,
  }));

export const nxSelectable = (catalog: ConfigCatalog, mode: WizardMode | null): boolean => mode === 'nx' && catalog.nx !== undefined;

export const stackDescription = (entry: CatalogAppType, plain: boolean): string =>
  plain && entry.stackPlain !== null ? entry.stackPlain : entry.stack;

export function serviceTypeOptions(catalog: ConfigCatalog) {
  return catalog.serviceTypes;
}

export function backendFamilies(catalog: ConfigCatalog): Array<BackendFamily & { options: CatalogAppType[] }> {
  return BACKEND_FAMILIES.map((family) => ({
    ...family,
    options: family.types.flatMap((type) => {
      const entry = appTypeEntry(catalog, type);
      return entry && entry.role === 'backend' ? [entry] : [];
    }),
  })).filter((family) => family.options.length > 0);
}
