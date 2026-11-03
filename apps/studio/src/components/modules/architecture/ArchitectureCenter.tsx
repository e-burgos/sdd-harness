'use client';

import { BasicTable, EmptyState, ErrorState, Skeleton, StateBadge, type StateBadgeTone, type TableColumn } from '@e-burgos/tucu-ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { PANEL_TYPE, ROW_ICON } from '@/lib/typography-tokens';
import { useActiveSection } from './ArchitecturePanel';
import {
  REGISTRY_PATH,
  filterComponents,
  filterEndpoints,
  filterTables,
  type ColumnEntry,
  type ComponentEntry,
  type EndpointEntry,
  type IndexEntry,
  type TableEntry,
} from './architecture-model';
import { useRegistries, type RegistryFailure } from './use-registries';

const STATUS_TONE: Record<string, StateBadgeTone> = {
  implemented: 'green',
  migrated: 'green',
  validated: 'green',
  updated: 'orange',
  'in-progress': 'orange',
};

const METHOD_TONE: Record<string, StateBadgeTone> = { GET: 'teal', POST: 'green', PUT: 'orange', PATCH: 'orange', DELETE: 'red' };

function useStatusLabel() {
  const { t } = useT();
  return (status: string): string => {
    const key = `architecture.status.${status}`;
    const label = t(key as keyof Dict);
    return label === key ? status : label;
  };
}

function StatusBadge({ status }: { status: string }) {
  const label = useStatusLabel();
  return (
    <StateBadge tone={STATUS_TONE[status] ?? 'neutral'} size="sm" dot>
      {label(status)}
    </StateBadge>
  );
}

function Mono({ children }: { children: string }) {
  return <span className="font-mono text-ui text-ink-100">{children}</span>;
}

function TableFrame<T extends Record<string, unknown>>({ columns, data }: { columns: TableColumn<T>[]; data: T[] }) {
  return (
    <div data-studio-exempt="hosted-component">
      <BasicTable density="snug" resizable={false} mobileCards={false} hoverable columns={columns} data={data} />
    </div>
  );
}

function Header({ title, subtitle, meta }: { title: string; subtitle: string; meta: string }) {
  return (
    <header className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <h1 className="text-title font-semibold text-ink-50">{title}</h1>
        <span className="text-meta text-ink-400">{meta}</span>
      </div>
      <p className="text-copy text-ink-400">{subtitle}</p>
    </header>
  );
}

function Missing({ section }: { section: 'db' | 'api' | 'components' }) {
  const { t } = useT();
  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState size="sm" title={t(`architecture.empty.${section}.title` as keyof Dict)} description={t(`architecture.empty.${section}.body` as keyof Dict)} />
    </div>
  );
}

function Loading() {
  const { t } = useT();
  return (
    <div role="status" aria-label={t('architecture.loading')} className="mx-auto flex w-full max-w-5xl flex-col gap-3 p-6">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} height="2.5rem" />
      ))}
    </div>
  );
}

function Failure({ section, reason, onRetry }: { section: 'db' | 'api' | 'components'; reason: RegistryFailure; onRetry: () => void }) {
  const { t } = useT();
  return (
    <div className="flex h-full items-center justify-center p-6" data-architecture-error={reason}>
      <ErrorState size="sm" title={t('architecture.error.title')} description={t(`architecture.error.${reason}` as keyof Dict, { file: REGISTRY_PATH[section] })} onRetry={onRetry} />
    </div>
  );
}

function NoResults() {
  const { t } = useT();
  return <p role="status" className="px-1 py-4 text-copy text-ink-400">{t('architecture.noResults')}</p>;
}

function TableSection({ table }: { table: TableEntry }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;
  const columnColumns: TableColumn<ColumnEntry & Record<string, unknown>>[] = [
    { key: 'name', label: t('architecture.col.column'), render: (value) => <Mono>{String(value)}</Mono> },
    { key: 'type', label: t('architecture.col.type') },
    { key: 'constraints', label: t('architecture.col.constraints') },
    { key: 'notes', label: t('architecture.col.notes') },
  ];
  const indexColumns: TableColumn<IndexEntry & Record<string, unknown>>[] = [
    { key: 'name', label: t('architecture.col.name') },
    { key: 'type', label: t('architecture.col.type') },
    { key: 'columns', label: t('architecture.col.columns') },
  ];
  return (
    <section data-architecture-table={table.name} className="flex flex-col gap-2 border-t border-foreground/10 pt-2 first:border-t-0 first:pt-0">
      <button
        type="button"
        aria-expanded={open}
        aria-label={t('architecture.table.toggle', { name: table.name })}
        onClick={() => setOpen((value) => !value)}
        className="flex h-7 w-full items-center gap-2 rounded-md px-1 text-left hover:bg-ink-800"
      >
        <Chevron aria-hidden size={ROW_ICON} className="shrink-0 text-ink-400" />
        <span className="min-w-0 truncate font-mono text-copy text-ink-50">{table.name}</span>
        {table.module !== '' && <span className="truncate text-meta text-ink-400">{table.module}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {table.migrationFile !== '' && <span className="hidden font-mono text-meta text-ink-400 md:inline">{table.migrationFile}</span>}
          <span className="font-mono text-meta text-ink-400">{t('architecture.count.columns', { count: table.columns.length })}</span>
          <StatusBadge status={table.status} />
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 pl-6">
          {table.columns.length === 0 ? (
            <p className="text-copy text-ink-400">{t('architecture.table.noColumns')}</p>
          ) : (
            <TableFrame columns={columnColumns} data={table.columns as (ColumnEntry & Record<string, unknown>)[]} />
          )}
          {table.indexes.length > 0 && (
            <>
              <h3 className="text-small font-medium text-ink-400">{t('architecture.table.indexes')}</h3>
              <TableFrame columns={indexColumns} data={table.indexes as (IndexEntry & Record<string, unknown>)[]} />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function SchemaView({ tables, total, query }: { tables: TableEntry[]; total: number; query: string }) {
  const { t } = useT();
  const shown = useMemo(() => filterTables(query, tables), [tables, query]);
  const meta = query.trim() === '' ? t('architecture.count.tables', { count: total }) : t('architecture.count.filtered', { shown: shown.length, total });
  return (
    <>
      <Header title={t('architecture.section.db')} subtitle={t('architecture.db.subtitle')} meta={meta} />
      {shown.length === 0 ? <NoResults /> : <div className="flex flex-col gap-2">{shown.map((table) => <TableSection key={table.key} table={table} />)}</div>}
    </>
  );
}

function groupByApp(endpoints: EndpointEntry[]): [string, EndpointEntry[]][] {
  const groups = new Map<string, EndpointEntry[]>();
  endpoints.forEach((endpoint) => groups.set(endpoint.app, [...(groups.get(endpoint.app) ?? []), endpoint]));
  return [...groups.entries()];
}

function ApiView({ endpoints, total, query }: { endpoints: EndpointEntry[]; total: number; query: string }) {
  const { t } = useT();
  const shown = useMemo(() => filterEndpoints(query, endpoints), [endpoints, query]);
  const meta = query.trim() === '' ? t('architecture.count.endpoints', { count: total }) : t('architecture.count.filtered', { shown: shown.length, total });
  const columns: TableColumn<EndpointEntry & Record<string, unknown>>[] = [
    {
      key: 'method',
      label: t('architecture.col.method'),
      width: 96,
      render: (value) => (
        <StateBadge tone={METHOD_TONE[String(value)] ?? 'neutral'} size="sm">
          {String(value)}
        </StateBadge>
      ),
    },
    { key: 'path', label: t('architecture.col.path'), render: (value) => <Mono>{String(value)}</Mono> },
    { key: 'description', label: t('architecture.col.description'), render: (value) => <span className="text-copy text-ink-300">{String(value)}</span> },
    { key: 'module', label: t('architecture.col.module') },
    { key: 'responses', label: t('architecture.col.responses') },
    { key: 'status', label: t('architecture.col.status'), render: (value) => <StatusBadge status={String(value)} /> },
  ];
  return (
    <>
      <Header title={t('architecture.section.api')} subtitle={t('architecture.api.subtitle')} meta={meta} />
      {shown.length === 0 ? (
        <NoResults />
      ) : (
        groupByApp(shown).map(([app, group]) => (
          <section key={app} data-architecture-group={app} className="flex flex-col gap-2">
            <h2 className={PANEL_TYPE.group}>{app}</h2>
            <TableFrame columns={columns} data={group as (EndpointEntry & Record<string, unknown>)[]} />
          </section>
        ))
      )}
    </>
  );
}

function ComponentsView({ components, total, query }: { components: ComponentEntry[]; total: number; query: string }) {
  const { t } = useT();
  const shown = useMemo(() => filterComponents(query, components), [components, query]);
  const meta = query.trim() === '' ? t('architecture.count.components', { count: total }) : t('architecture.count.filtered', { shown: shown.length, total });
  const columns: TableColumn<ComponentEntry & Record<string, unknown>>[] = [
    { key: 'id', label: t('architecture.col.id'), width: 96, render: (value) => <Mono>{String(value)}</Mono> },
    { key: 'name', label: t('architecture.col.name'), render: (value) => <Mono>{String(value)}</Mono> },
    { key: 'type', label: t('architecture.col.kind') },
    { key: 'app', label: t('architecture.col.subproject') },
    { key: 'description', label: t('architecture.col.description'), render: (value) => <span className="text-copy text-ink-300">{String(value)}</span> },
    { key: 'path', label: t('architecture.col.path') },
    { key: 'cycle', label: t('architecture.col.cycle'), width: 72 },
    { key: 'status', label: t('architecture.col.status'), render: (value) => <StatusBadge status={String(value)} /> },
  ];
  return (
    <>
      <Header title={t('architecture.section.components')} subtitle={t('architecture.components.subtitle')} meta={meta} />
      {shown.length === 0 ? <NoResults /> : <TableFrame columns={columns} data={shown as (ComponentEntry & Record<string, unknown>)[]} />}
    </>
  );
}

export function ArchitectureCenter() {
  const registries = useRegistries();
  const section = useActiveSection();
  const [query] = useModuleQuery('architecture');
  const state = registries[section];
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <Failure section={section} reason={state.reason} onRetry={registries.reload} />;
  if (state.items.length === 0) return <Missing section={section} />;
  return (
    <div data-architecture-section={section} className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4 overflow-y-auto p-6">
      {section === 'db' && registries.db.status === 'ready' && <SchemaView tables={registries.db.items} total={registries.db.items.length} query={query} />}
      {section === 'api' && registries.api.status === 'ready' && <ApiView endpoints={registries.api.items} total={registries.api.items.length} query={query} />}
      {section === 'components' && registries.components.status === 'ready' && <ComponentsView components={registries.components.items} total={registries.components.items.length} query={query} />}
    </div>
  );
}
