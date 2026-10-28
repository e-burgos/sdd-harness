import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { BridgeError } from '@/lib/bridge/client';
import { MODULES } from '@/lib/nav/modules';
import { bridgeValue, renderShell } from '../../shell/shell-test-utils';
import { collectComponents, collectEndpoints, collectTables, parseRegistry } from './architecture-model';

const schema = {
  $schema: './schemas/db-schema.schema.json',
  _comment: 'x',
  'apps/api': {
    tables: {
      accounts: {
        module: 'pagos',
        status: 'migrated',
        migration_file: 'V1__create_accounts.sql',
        columns: { id: { type: 'uuid', constraints: ['PK'] }, owner_id: { type: 'uuid', constraints: ['FK -> owners.id'], notes: 'dueño' } },
        indexes: [{ name: 'idx_owner', type: 'btree', columns: ['owner_id'] }],
      },
      owners: { module: 'pagos', status: 'defined', columns: {} },
    },
  },
};

const api = { 'apps/api': { endpoints: [{ id: 'EP-001', method: 'get', path: '/accounts', description: 'Lista cuentas', module: 'pagos', status: 'implemented', responses: { '200': 'ok', '404': 'no' } }, { id: 'EP-002', method: 'POST', path: '/owners', description: 'Crea dueños', module: 'otros', status: 'defined' }] } };

const components = { 'apps/studio': { components: [{ id: 'COMP-001', name: 'NavTree', type: 'component', description: 'Árbol de navegación', path: 'src/NavTree.tsx', status: 'updated', created_in_cycle: 1, updated_in_cycle: 2 }] } };

const files: Record<string, unknown> = { 'sdd/schema.json': schema, 'sdd/api.json': api, 'sdd/components.json': components };

const { Panel, Center, Scope } = MODULES.architecture;

function setup(available: string[] = Object.keys(files), lang: 'es' | 'en' = 'es', override: Record<string, string> = {}) {
  window.localStorage.clear();
  const request = async (command: { cmd: string; path?: string }) => {
    if (command.cmd === 'workspace.readFile' && command.path && command.path in override) return { path: command.path, content: override[command.path] };
    if (command.cmd === 'workspace.readFile' && command.path && available.includes(command.path)) return { path: command.path, content: JSON.stringify(files[command.path]) };
    throw new BridgeError('not-found', 'no existe');
  };
  const Wrap = Scope!;
  return renderShell(
    <Wrap>
      <Panel />
      <Center />
    </Wrap>,
    { lang, value: bridgeValue({ client: { request, supports: () => false } as never }) },
  );
}

describe('architecture model', () => {
  it('flattens the three registries and ignores underscore keys', () => {
    expect(collectTables(parseRegistry(JSON.stringify(schema))).map((t) => t.name)).toEqual(['accounts', 'owners']);
    expect(collectEndpoints(parseRegistry(JSON.stringify(api)))[0]).toMatchObject({ method: 'GET', responses: '200 · 404' });
    expect(collectComponents(parseRegistry(JSON.stringify(components)))[0]).toMatchObject({ cycle: '1 → 2', app: 'apps/studio' });
    expect(parseRegistry('not json')).toBeNull();
  });
});

describe('architecture module', () => {
  it('has no right panel and lists the three registries with counts', async () => {
    expect(MODULES.architecture.Right).toBeNull();
    setup();
    await waitFor(() => expect(screen.getByRole('button', { name: /Schema de base de datos/ }).textContent).toContain('2'));
    expect(screen.getByRole('button', { name: /^API/ }).textContent).toContain('2');
    expect(screen.getByRole('button', { name: /^Componentes/ }).textContent).toContain('1');
  });

  it('shows tables and expands columns with constraints and indexes', async () => {
    setup();
    await screen.findByText('owners');
    const section = document.querySelector('[data-architecture-table="accounts"]') as HTMLElement;
    fireEvent.click(within(section).getByRole('button', { name: /accounts/ }));
    expect(within(section).getByText('FK -> owners.id')).toBeTruthy();
    expect(within(section).getByText('idx_owner')).toBeTruthy();
  });

  it('switches to the API section and filters rows with the search', async () => {
    setup();
    await waitFor(() => screen.getByRole('button', { name: /^API/ }));
    fireEvent.click(screen.getByRole('button', { name: /^API/ }));
    await screen.findByText('/accounts');
    expect(screen.getByText('/owners')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Buscar en Arquitectura'), { target: { value: 'owners' } });
    expect(screen.queryByText('/accounts')).toBeNull();
    expect(screen.getByText('/owners')).toBeTruthy();
  });

  it('groups endpoints by app with method, path and description', async () => {
    setup();
    await waitFor(() => screen.getByRole('button', { name: /^API/ }));
    fireEvent.click(screen.getByRole('button', { name: /^API/ }));
    await screen.findByText('/accounts');
    const group = document.querySelector('[data-architecture-group="apps/api"]') as HTMLElement;
    expect(within(group).getByRole('heading', { name: 'apps/api' })).toBeTruthy();
    expect(within(group).getByText('Lista cuentas')).toBeTruthy();
    expect(within(group).getByText('Crea dueños')).toBeTruthy();
    expect(within(group).getByText('GET')).toBeTruthy();
  });

  it('shows components with subproject and status', async () => {
    setup();
    await waitFor(() => screen.getByRole('button', { name: /^Componentes/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Componentes/ }));
    await screen.findByText('NavTree');
    expect(screen.getByText('apps/studio')).toBeTruthy();
    expect(screen.getByText('Actualizado')).toBeTruthy();
    expect(screen.getByText('Árbol de navegación')).toBeTruthy();
  });

  it('shows a scoped error with retry when the registry file is missing', async () => {
    setup(['sdd/api.json']);
    const error = await screen.findByText('No se pudo leer el registro');
    expect(error).toBeTruthy();
    expect(document.querySelector('[data-architecture-error="missing"]')).toBeTruthy();
    expect(screen.getByText(/sdd\/schema.json no existe/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /reintentar|intentar/i })).toBeTruthy();
  });

  it('shows an invalid error when the file is not valid JSON', async () => {
    setup(Object.keys(files), 'es', { 'sdd/schema.json': 'not json' });
    await screen.findByText('No se pudo leer el registro');
    expect(document.querySelector('[data-architecture-error="invalid"]')).toBeTruthy();
  });

  it('shows the empty state only when the registry is valid but has no entries', async () => {
    setup(Object.keys(files), 'es', { 'sdd/schema.json': JSON.stringify({ 'apps/api': { tables: {} } }) });
    expect(await screen.findByText('Schema vacío')).toBeTruthy();
    expect(document.querySelector('[data-architecture-error]')).toBeNull();
  });

  it('shows a loading indicator while the registries are read', () => {
    setup();
    expect(screen.getByRole('status', { name: 'Cargando registro' })).toBeTruthy();
  });

  it('renders in English', async () => {
    setup(Object.keys(files), 'en');
    await screen.findByText('2 tables');
  });
});
