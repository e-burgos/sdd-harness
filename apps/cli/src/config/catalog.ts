import { version } from '../version.js';
import {
  APP_TYPE_OPTIONS,
  DEFAULT_APP_NAMES,
  LIB_TYPE_OPTIONS,
  SERVICE_OPTIONS,
} from './app-options.js';
import { DEFAULT_SERVICES } from './defaults.js';
import { buildConfigJsonSchema } from './json-schema.js';
import { MAX_CONFIG_BYTES } from './validate.js';
import {
  CONFIG_LIMITS,
  AUTHOR_PATTERN,
  KEBAB_NAME_PATTERN,
  PACKAGE_SCOPE_PATTERN,
  PORT_RANGE,
  PROFILE_VALUES,
} from './schema.js';
import {
  DEFAULT_NX_MAJOR,
  NX_MAJORS,
  NX_VERSIONS,
  type NxMajor,
} from '../generators/versions.js';
import { DEFAULT_APP_PORTS } from '../generators/app.generator.js';
import {
  TUCU_UI_APP_TYPES,
  describeAppStack,
  isWorkspaceOnlyAppType,
} from '../generators/app-types.js';
import { TOLERATED_ENTRIES } from '../generators/workspace.generator.js';

export interface CatalogAppType {
  type: string;
  label: string;
  hint: string;
  role: 'frontend' | 'backend';
  defaultName: string;
  defaultPort: number;
  stack: string;
  stackPlain: string | null;
  workspaceOnly: boolean;
  tucuUi: boolean;
  ml: boolean;
  shell: boolean;
}

export interface ConfigCatalog {
  format: 1;
  cliVersion: string;
  modes: Array<{ mode: 'nx' | 'standalone'; maxApps: number | null; libs: boolean }>;
  appTypes: CatalogAppType[];
  libTypes: Array<{ type: string; label: string }>;
  serviceTypes: Array<{
    type: string;
    label: string;
    hint: string;
    defaultPort: number;
    version: string;
  }>;
  profiles: Array<'team' | 'solo'>;
  nx: { majors: NxMajor[]; default: NxMajor; versions: Record<string, string> };
  patterns: { name: string; packageScope: string; author: string };
  portRange: { min: number; max: number };
  targetDir: { tolerated: string[] };
  limits: {
    nameMax: number;
    packageScopeMax: number;
    maxApps: number;
    maxLibs: number;
    maxServices: number;
    configBytes: number;
  };
  jsonSchema: Record<string, unknown>;
}

const FALLBACK_PORT = 3000;

function buildAppType(option: (typeof APP_TYPE_OPTIONS)[number]): CatalogAppType {
  const { value: type } = option;
  const tucuUi = (TUCU_UI_APP_TYPES as readonly string[]).includes(type);
  return {
    type,
    label: option.label,
    hint: option.hint,
    role: tucuUi ? 'frontend' : 'backend',
    defaultName: DEFAULT_APP_NAMES[type] ?? type,
    defaultPort: DEFAULT_APP_PORTS[type] ?? FALLBACK_PORT,
    stack: describeAppStack(type, true) ?? type,
    stackPlain: tucuUi ? (describeAppStack(type, false) ?? null) : null,
    workspaceOnly: isWorkspaceOnlyAppType(type),
    tucuUi,
    ml: type === 'python',
    shell: type === 'mfe',
  };
}

export function buildConfigCatalog(): ConfigCatalog {
  return {
    format: 1,
    cliVersion: version,
    modes: [
      { mode: 'nx', maxApps: null, libs: true },
      { mode: 'standalone', maxApps: 1, libs: false },
    ],
    appTypes: APP_TYPE_OPTIONS.map(buildAppType),
    libTypes: LIB_TYPE_OPTIONS.map(({ value, label }) => ({ type: value, label })),
    serviceTypes: SERVICE_OPTIONS.map(({ value, label, hint }) => ({
      type: value,
      label,
      hint,
      defaultPort: DEFAULT_SERVICES[value]?.port ?? 0,
      version: DEFAULT_SERVICES[value]?.version ?? 'latest',
    })),
    profiles: [...PROFILE_VALUES],
    nx: {
      majors: [...NX_MAJORS],
      default: DEFAULT_NX_MAJOR,
      versions: Object.fromEntries(NX_MAJORS.map((major) => [String(major), NX_VERSIONS[major]])),
    },
    patterns: {
      name: KEBAB_NAME_PATTERN.source,
      packageScope: PACKAGE_SCOPE_PATTERN.source,
      author: AUTHOR_PATTERN.source,
    },
    portRange: { ...PORT_RANGE },
    targetDir: { tolerated: [...TOLERATED_ENTRIES].sort() },
    limits: { ...CONFIG_LIMITS, configBytes: MAX_CONFIG_BYTES },
    jsonSchema: buildConfigJsonSchema(),
  };
}

export function formatConfigCatalog(catalog: ConfigCatalog): string {
  const lines = [
    `harness ${catalog.cliVersion} config catalog`,
    '',
    'App types:',
    ...catalog.appTypes.map(
      (a) =>
        `  ${a.type.padEnd(11)} ${a.role.padEnd(9)} port ${String(a.defaultPort).padEnd(5)} ${a.label}${a.workspaceOnly ? ' (monorepo only)' : ''}`,
    ),
    '',
    'Libs:',
    ...catalog.libTypes.map((l) => `  ${l.type.padEnd(13)} ${l.label}`),
    '',
    'Services:',
    ...catalog.serviceTypes.map(
      (s) => `  ${s.type.padEnd(9)} port ${String(s.defaultPort).padEnd(5)} v${s.version}  ${s.label}`,
    ),
    '',
    `Modes: ${catalog.modes.map((m) => `${m.mode} (${m.maxApps === null ? 'any apps' : `${m.maxApps} app`}, libs ${m.libs ? 'yes' : 'no'})`).join(', ')}`,
    `Profiles: ${catalog.profiles.join(', ')}`,
    `Nx majors: ${catalog.nx.majors.map((m) => `${m} (${catalog.nx.versions[String(m)]})`).join(', ')} — default ${catalog.nx.default}`,
    `Ports: ${catalog.portRange.min}-${catalog.portRange.max}`,
    `Tolerated target entries: ${catalog.targetDir.tolerated.join(', ')}`,
  ];
  return `${lines.join('\n')}\n`;
}
