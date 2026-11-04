import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'fs-extra';
import { version } from '../version.js';
import { DEFAULT_SERVICES } from './defaults.js';
import { HarnessConfigSchema } from './schema.js';
import {
  DEFAULT_APP_PORTS,
  resolveAppPorts,
  type AppSpec,
} from '../generators/app.generator.js';
import {
  collectAppTopologyIssues,
  describeAppStack,
  resolveMfeShell,
  type TopologyApp,
} from '../generators/app-types.js';
import { resolveAppTucuUi } from '../utils/tucu-ui-offer.js';
import type { HarnessConfig } from '../types/config.types.js';

export const MAX_CONFIG_BYTES = 65_536;
const MAX_ISSUES = 100;
const MAX_MESSAGE_LENGTH = 500;
const FALLBACK_PORT = 3000;

export type ConfigIssueSeverity = 'error' | 'warning';
export type ConfigIssuePath = Array<string | number>;

export interface ConfigIssue {
  severity: ConfigIssueSeverity;
  code: string;
  path: ConfigIssuePath;
  message: string;
}

export interface ResolvedApp {
  name: string;
  type: string;
  path: string;
  port: number;
  portSource: 'explicit' | 'default' | 'shifted';
  tucuUi: boolean | null;
  ml: boolean;
  shell: string | null;
  route: string | null;
  stack: string;
}

export interface ResolvedConfig {
  mode: 'nx' | 'standalone';
  project: { name: string; packageScope: string };
  apps: ResolvedApp[];
  libs: Array<{ name: string; type: string; path: string }>;
  services: Array<{ type: string; port: number; version: string }>;
  dockerCompose: boolean;
  profile: 'team' | 'solo';
}

export interface ConfigValidation {
  format: 1;
  cliVersion: string;
  ok: boolean;
  issues: ConfigIssue[];
  resolved: ResolvedConfig | null;
}

export class ConfigReadError extends Error {}

interface RawApp extends TopologyApp {
  port?: number;
}

interface RawShape {
  mode?: unknown;
  apps?: unknown;
  libs?: unknown;
  services?: unknown;
  name?: unknown;
  type?: unknown;
}

function isRecord(value: unknown): value is RawShape {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function wellFormedApps(raw: unknown): RawApp[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.apps)) return null;
  const apps = raw.apps;
  const ok = apps.every(
    (app) => isRecord(app) && typeof app.name === 'string' && typeof app.type === 'string',
  );
  return ok ? (apps as RawApp[]) : null;
}

function namedEntries(raw: unknown, key: 'apps' | 'libs'): Array<{ name: string }> | null {
  if (!isRecord(raw)) return null;
  const entries = raw[key];
  if (!Array.isArray(entries)) return null;
  return entries.every((e) => isRecord(e) && typeof e.name === 'string')
    ? (entries as Array<{ name: string }>)
    : null;
}

function rawMode(raw: unknown): 'nx' | 'standalone' {
  return isRecord(raw) && raw.mode === 'standalone' ? 'standalone' : 'nx';
}

function clip(message: string): string {
  return message.length > MAX_MESSAGE_LENGTH ? `${message.slice(0, MAX_MESSAGE_LENGTH - 1)}…` : message;
}

function schemaIssues(raw: unknown): { issues: ConfigIssue[]; data: HarnessConfig | null } {
  const parsed = HarnessConfigSchema.safeParse(raw);
  if (parsed.success) return { issues: [], data: parsed.data as HarnessConfig };
  const issues = parsed.error.issues
    .filter((i) => !(i.code === 'custom' && i.path.length === 1 && i.path[0] === 'apps'))
    .map<ConfigIssue>((i) => ({
      severity: 'error',
      code: i.code,
      path: i.path as ConfigIssuePath,
      message: clip(i.message),
    }));
  return { issues, data: null };
}

function topologyIssues(raw: unknown): ConfigIssue[] {
  const apps = wellFormedApps(raw);
  if (!apps) return [];
  return collectAppTopologyIssues(apps, rawMode(raw)).map((issue) => ({
    severity: 'error',
    code: issue.code,
    path: ['apps', issue.appIndex, issue.field],
    message: issue.message,
  }));
}

function duplicateNameIssues(
  entries: Array<{ name: string }> | null,
  key: 'apps' | 'libs',
  code: string,
): ConfigIssue[] {
  if (!entries) return [];
  const seen = new Set<string>();
  const issues: ConfigIssue[] = [];
  entries.forEach((entry, index) => {
    if (seen.has(entry.name)) {
      issues.push({
        severity: 'error',
        code,
        path: [key, index, 'name'],
        message: `Duplicate ${key === 'apps' ? 'app' : 'lib'} name "${entry.name}".`,
      });
    }
    seen.add(entry.name);
  });
  return issues;
}

function preconditionIssues(raw: unknown): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const apps = namedEntries(raw, 'apps');
  if (rawMode(raw) === 'standalone' && isRecord(raw) && Array.isArray(raw.apps) && raw.apps.length !== 1) {
    issues.push({
      severity: 'error',
      code: 'standalone-app-count',
      path: ['apps'],
      message: `Standalone mode requires exactly one app in "apps" (got ${raw.apps.length}).`,
    });
  }
  issues.push(...duplicateNameIssues(apps, 'apps', 'duplicate-app-name'));
  issues.push(...duplicateNameIssues(namedEntries(raw, 'libs'), 'libs', 'duplicate-lib-name'));
  return issues;
}

interface PortRow {
  port: number;
  path: ConfigIssuePath;
  label: string;
  isApp: boolean;
}

function resolvedAppPorts(apps: RawApp[]): Map<string, number> {
  const specs: AppSpec[] = apps.map((a) => ({
    name: a.name,
    type: a.type,
    port: typeof a.port === 'number' ? a.port : undefined,
  }));
  return resolveAppPorts(specs);
}

function portConflictIssues(raw: unknown): ConfigIssue[] {
  const apps = wellFormedApps(raw);
  if (!apps || new Set(apps.map((a) => a.name)).size !== apps.length) return [];
  const ports = resolvedAppPorts(apps);
  const rows: PortRow[] = apps.map((app, index) => ({
    port: ports.get(app.name) as number,
    path: ['apps', index, 'port'],
    label: `app "${app.name}"`,
    isApp: true,
  }));
  const services = isRecord(raw) && Array.isArray(raw.services) ? (raw.services as unknown[]) : [];
  services.forEach((service, index) => {
    const type = isRecord(service) ? service.type : undefined;
    const port = typeof type === 'string' ? DEFAULT_SERVICES[type]?.port : undefined;
    if (port === undefined) return;
    rows.push({ port, path: ['services', index, 'type'], label: `service "${String(type)}"`, isApp: false });
  });

  const byPort = new Map<number, PortRow[]>();
  for (const row of rows) byPort.set(row.port, [...(byPort.get(row.port) ?? []), row]);

  const issues: ConfigIssue[] = [];
  for (const [port, group] of byPort) {
    if (group.length < 2 || !group.some((r) => r.isApp)) continue;
    for (const row of group) {
      const others = group.filter((r) => r !== row).map((r) => r.label);
      issues.push({
        severity: 'warning',
        code: 'port-conflict',
        path: row.path,
        message: `Port ${port} of ${row.label} is also used by ${others.join(', ')}.`,
      });
    }
  }
  return issues;
}

function standaloneLibsIssues(raw: unknown): ConfigIssue[] {
  if (rawMode(raw) !== 'standalone' || !isRecord(raw)) return [];
  const libs = raw.libs;
  if (!Array.isArray(libs) || libs.length === 0) return [];
  return [
    {
      severity: 'warning',
      code: 'standalone-libs-ignored',
      path: ['libs'],
      message: 'Standalone mode generates a single app and ignores "libs".',
    },
  ];
}

function resolveApps(config: HarnessConfig): ResolvedApp[] {
  const standalone = config.mode === 'standalone';
  const specs: AppSpec[] = config.apps.map((a) => ({ name: a.name, type: a.type, port: a.port }));
  const ports = resolveAppPorts(specs);
  const topology: TopologyApp[] = config.apps;
  return config.apps.map((app) => {
    const port = ports.get(app.name) as number;
    const defaultPort = DEFAULT_APP_PORTS[app.type] ?? FALLBACK_PORT;
    const tucuUi = resolveAppTucuUi(app, { configDefault: config.sdd?.tucu_ui });
    const isFrontend = resolveAppTucuUi(app, { cliFlag: true }) !== undefined;
    const shell = app.type === 'mfe' && !standalone ? resolveMfeShell(app, topology) : undefined;
    const effectiveTucuUi = isFrontend ? tucuUi !== false : null;
    return {
      name: app.name,
      type: app.type,
      path: standalone ? '.' : `apps/${app.name}`,
      port,
      portSource: app.port ? 'explicit' : port === defaultPort ? 'default' : 'shifted',
      tucuUi: effectiveTucuUi,
      ml: app.ml ?? false,
      shell: shell?.name ?? null,
      route: shell ? `/${app.name}/` : null,
      stack: describeAppStack(app.type, effectiveTucuUi ?? undefined) ?? app.type,
    };
  });
}

function buildResolved(config: HarnessConfig): ResolvedConfig {
  const standalone = config.mode === 'standalone';
  return {
    mode: config.mode,
    project: { name: config.project.name, packageScope: config.project.packageScope },
    apps: resolveApps(config),
    libs: standalone
      ? []
      : config.libs.map((l) => ({ name: l.name, type: l.type, path: `libs/${l.name}` })),
    services: config.services.map((s) => ({
      type: s.type,
      port: DEFAULT_SERVICES[s.type]?.port ?? 0,
      version: DEFAULT_SERVICES[s.type]?.version ?? 'latest',
    })),
    dockerCompose: config.services.length > 0,
    profile: config.sdd?.profile ?? 'team',
  };
}

export function validateHarnessConfig(raw: unknown): ConfigValidation {
  const { issues: zodIssues, data } = schemaIssues(raw);
  const errors = [...zodIssues, ...topologyIssues(raw), ...preconditionIssues(raw)];
  const warnings = [...portConflictIssues(raw), ...standaloneLibsIssues(raw)];
  const ok = errors.length === 0 && data !== null;
  return {
    format: 1,
    cliVersion: version,
    ok,
    issues: [...errors, ...warnings].slice(0, MAX_ISSUES),
    resolved: ok && data ? buildResolved(data) : null,
  };
}

export function formatConfigValidation(validation: ConfigValidation): string {
  const lines = validation.issues.map(
    (i) => `${i.severity === 'error' ? 'error  ' : 'warning'} ${i.path.join('.') || '(root)'}: ${i.message} [${i.code}]`,
  );
  lines.push(validation.ok ? 'Config is valid.' : 'Config has errors.');
  return `${lines.join('\n')}\n`;
}

export async function readRawConfigFile(path: string): Promise<unknown> {
  const abs = resolve(process.cwd(), path);
  if (!(await fs.pathExists(abs))) throw new ConfigReadError(`Config file not found: ${abs}`);
  const ext = extname(abs);
  try {
    if (ext === '.json') return await fs.readJSON(abs);
    if (ext === '.mjs' || ext === '.js') {
      const mod = await import(pathToFileURL(abs).href);
      return mod.default ?? mod.config;
    }
  } catch (err) {
    throw new ConfigReadError(`Cannot read ${path}: ${(err as Error).message}`);
  }
  throw new ConfigReadError(`Unsupported config format "${ext}" — use .json, .mjs or .js.`);
}

export async function readRawConfigFromStream(stream: AsyncIterable<Buffer | string>): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > MAX_CONFIG_BYTES) {
      throw new ConfigReadError(`Config on stdin exceeds ${MAX_CONFIG_BYTES} bytes.`);
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch (err) {
    throw new ConfigReadError(`stdin is not valid JSON: ${(err as Error).message}`);
  }
}
