import { matchesQuery } from '@/lib/nav/search';

export type RegistryKey = 'db' | 'api' | 'components';

export const REGISTRY_PATH: Record<RegistryKey, string> = {
  db: 'sdd/schema.json',
  api: 'sdd/api.json',
  components: 'sdd/components.json',
};

export interface ColumnEntry {
  name: string;
  type: string;
  constraints: string;
  notes: string;
}

export interface IndexEntry {
  name: string;
  type: string;
  columns: string;
}

export interface TableEntry {
  key: string;
  app: string;
  name: string;
  module: string;
  status: string;
  migrationFile: string;
  columns: ColumnEntry[];
  indexes: IndexEntry[];
}

export interface EndpointEntry {
  key: string;
  app: string;
  id: string;
  method: string;
  path: string;
  module: string;
  status: string;
  description: string;
  responses: string;
}

export interface ComponentEntry {
  key: string;
  app: string;
  id: string;
  name: string;
  type: string;
  status: string;
  path: string;
  cycle: string;
  description: string;
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, fallback = ''): string => (typeof value === 'string' || typeof value === 'number' ? String(value) : fallback);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export function parseRegistry(content: string): Json | null {
  try {
    const parsed: unknown = JSON.parse(content);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function appEntries(registry: Json | null): [string, Json][] {
  if (registry === null) return [];
  return Object.entries(registry).flatMap(([key, value]) => (key.startsWith('_') || key.startsWith('$') || !isObject(value) ? [] : [[key, value] as [string, Json]]));
}

export function collectTables(registry: Json | null): TableEntry[] {
  return appEntries(registry).flatMap(([app, value]) =>
    isObject(value['tables'])
      ? Object.entries(value['tables']).flatMap(([name, raw]) => {
          if (!isObject(raw)) return [];
          const columns = isObject(raw['columns'])
            ? Object.entries(raw['columns']).map(([columnName, column]) => {
                const entry = isObject(column) ? column : {};
                return {
                  name: columnName,
                  type: text(entry['type'], '—'),
                  constraints: list(entry['constraints']).map((item) => text(item)).join(' · '),
                  notes: text(entry['notes']),
                };
              })
            : [];
          const indexes = list(raw['indexes']).map((item) => {
            const entry = isObject(item) ? item : {};
            return { name: text(entry['name'], '—'), type: text(entry['type'], '—'), columns: list(entry['columns']).map((c) => text(c)).join(', ') };
          });
          return [{ key: `${app}::${name}`, app, name, module: text(raw['module']), status: text(raw['status'], 'defined'), migrationFile: text(raw['migration_file']), columns, indexes }];
        })
      : [],
  );
}

function describeResponses(value: unknown): string {
  return isObject(value) ? Object.keys(value).join(' · ') : '';
}

export function collectEndpoints(registry: Json | null): EndpointEntry[] {
  return appEntries(registry).flatMap(([app, value]) =>
    list(value['endpoints']).flatMap((raw, index) => {
      if (!isObject(raw)) return [];
      return [
        {
          key: `${app}::${index}`,
          app,
          id: text(raw['id']),
          method: text(raw['method'], '—').toUpperCase(),
          path: text(raw['path']),
          module: text(raw['module']),
          status: text(raw['status'], 'defined'),
          description: text(raw['description']),
          responses: describeResponses(raw['responses']),
        },
      ];
    }),
  );
}

export function collectComponents(registry: Json | null): ComponentEntry[] {
  return appEntries(registry).flatMap(([app, value]) =>
    list(value['components']).flatMap((raw, index) => {
      if (!isObject(raw)) return [];
      const created = raw['created_in_cycle'];
      const updated = raw['updated_in_cycle'];
      const cycle = created === null || created === undefined ? '—' : updated ? `${text(created)} → ${text(updated)}` : text(created);
      return [
        {
          key: `${app}::${text(raw['id'], String(index))}`,
          app,
          id: text(raw['id']),
          name: text(raw['name'], '—'),
          type: text(raw['type'], '—'),
          status: text(raw['status'], 'defined'),
          path: text(raw['path']),
          cycle,
          description: text(raw['description']),
        },
      ];
    }),
  );
}

export const filterTables = (query: string, tables: TableEntry[]): TableEntry[] =>
  tables.filter((table) => matchesQuery(query, table.name, table.module, table.app, table.status, ...table.columns.map((c) => c.name)));

export const filterEndpoints = (query: string, endpoints: EndpointEntry[]): EndpointEntry[] =>
  endpoints.filter((endpoint) => matchesQuery(query, endpoint.method, endpoint.path, endpoint.module, endpoint.app, endpoint.status, endpoint.id, endpoint.description));

export const filterComponents = (query: string, components: ComponentEntry[]): ComponentEntry[] =>
  components.filter((component) => matchesQuery(query, component.name, component.id, component.type, component.path, component.app, component.status, component.description));
