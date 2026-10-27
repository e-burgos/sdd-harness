import { fireEvent, screen, within } from '@testing-library/react';
import type { CycleSummary, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { MODULES } from '@/lib/nav/modules';
import { bridgeValue, renderShell, shellSnapshot } from '../../shell/shell-test-utils';

const fullCycle: CycleSummary = {
  specId: 'spec-dev-001-pagos',
  cycle: 'cycle-01',
  status: 'in-progress',
  flow: 'full',
  apps: ['api'],
  tasks: [
    { id: 'TASK-001', title: 'Modelo', status: 'done', storyPoints: 3 },
    { id: 'TASK-002', title: 'Endpoint', status: 'pending', storyPoints: null },
  ],
  tasksTotal: 2,
  tasksDone: 1,
  documents: ['functional.md', 'architect.md', 'artifacts/notas.md'],
};

const snapshot: WorkspaceSnapshot = {
  ...shellSnapshot,
  specs: [
    { ...shellSnapshot.specs[0]!, dependsOn: ['spec-dev-000-base'], document: 'sdd/specs/spec-dev-001-pagos/spec.md', module: 'pagos', app: 'api' },
    { id: 'spec-dev-000-base', title: 'Base', status: 'completed', folder: 'sdd/specs/spec-dev-000-base', module: null, app: null, dependsOn: [] },
    { id: 'spec-dev-002-plan', title: 'Plan futuro', status: 'draft', folder: 'sdd/specs/spec-dev-002-plan', module: null, app: null, dependsOn: [] },
  ],
  cycles: [fullCycle, { ...fullCycle, cycle: 'cycle-02', status: 'completed', flow: 'lite', tasks: [], tasksTotal: 0, tasksDone: 0, documents: [] }],
  fixes: [{ id: 'FIX-dev-001', title: 'Arreglo', status: 'pending', severity: 'high', specId: 'spec-dev-001-pagos', createdAt: null, closedAt: null, document: 'sdd/specs/spec-dev-001-pagos/fixes/f.md' }],
};

const { Panel, Center, Right } = MODULES.specs;
const Harness = () => (
  <>
    <Panel />
    <Center />
    {Right && <Right />}
  </>
);

function setup(snap: WorkspaceSnapshot = snapshot, lang: 'es' | 'en' = 'es') {
  window.localStorage.clear();
  return renderShell(<Harness />, { lang, value: bridgeValue({}, snap) });
}

describe('specs panel', () => {
  it('defaults to Activas and shows cycle chip with progress', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Activas1' }).getAttribute('aria-pressed')).toBe('true');
    const row = document.querySelector('[data-spec-row="spec-dev-001-pagos"]') as HTMLElement;
    expect(within(row).getByTestId('cycle-chip').textContent).toBe('c01 · full');
    expect(within(row).getByText('1 de 2 tareas')).toBeTruthy();
    expect(document.querySelector('[data-spec-row="spec-dev-000-base"]')).toBeNull();
  });

  it('switches filters and groups by state', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Todas3' }));
    expect(document.querySelectorAll('[data-panel-group]')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Cerradas1' }));
    expect(document.querySelectorAll('[data-panel-group]')).toHaveLength(1);
    expect(screen.getByText('Completadas')).toBeTruthy();
  });

  it('shows a filter-specific empty state, and no filters when the project has no specs', () => {
    setup({ ...snapshot, specs: [snapshot.specs[1]!], cycles: [] });
    expect(screen.getByText('No hay specs activas.')).toBeTruthy();
  });

  it('empty project has no filter pills', () => {
    setup({ ...snapshot, specs: [], cycles: [], fixes: [] });
    expect(screen.getByText('Este proyecto todavía no tiene specs.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Activas/ })).toBeNull();
  });

  it('opens the card on select and shows the five tabs with Resumen first', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Pagos/ }));
    const card = screen.getByTestId('spec-card');
    ['Resumen', 'Plan', 'Tareas', 'Documentos', 'Conversaciones'].forEach((name) => expect(within(card).getByRole('tab', { name })).toBeTruthy());
    expect(within(card).getByRole('tab', { name: 'Resumen' }).getAttribute('aria-selected')).toBe('true');
    expect(within(card).getByRole('button', { name: 'Abrir FIX-dev-001' })).toBeTruthy();
    expect(within(card).getByText(/spec-dev-000-base/)).toBeTruthy();
  });
});

describe('spec card tabs', () => {
  function openTab(name: string) {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Pagos/ }));
    fireEvent.click(within(screen.getByTestId('spec-card')).getByRole('tab', { name }));
    return screen.getByTestId('spec-card');
  }

  it('Plan lists full-flow documents and marks the missing one pending', () => {
    const card = openTab('Plan');
    expect(within(card).getByRole('button', { name: 'Abrir functional.md' })).toBeTruthy();
    expect(within(card).getByText('planner.md')).toBeTruthy();
    expect(within(card).getAllByText('pendiente')).toHaveLength(1);
    expect(within(card).queryByText('plan.md')).toBeNull();
  });

  it('Plan of a lite cycle without documents shows the empty state', () => {
    const card = openTab('Plan');
    fireEvent.click(within(card).getByRole('radio', { name: /c02/ }));
    expect(within(card).getByText('Este ciclo no tiene documentos de plan.')).toBeTruthy();
  });

  it('Tareas groups by status and the cycle can be changed', () => {
    const card = openTab('Tareas');
    expect(within(card).getByText('Pendientes')).toBeTruthy();
    expect(within(card).getByText('Hechas')).toBeTruthy();
    expect(within(card).getByText('TASK-001 · 3 pts')).toBeTruthy();
    fireEvent.click(within(card).getByRole('radio', { name: /c02/ }));
    expect(within(card).getByText('Este ciclo no tiene tareas.')).toBeTruthy();
  });

  it('Documentos groups by spec, cycle and fixes', () => {
    const card = openTab('Documentos');
    expect(within(card).getByRole('button', { name: 'Abrir spec.md' })).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Abrir artifacts/notas.md' })).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Abrir f.md' })).toBeTruthy();
  });

  it('Conversaciones shows an empty state with an entry to start one', () => {
    const card = openTab('Conversaciones');
    expect(within(card).getByText('Esta spec no tiene conversaciones.')).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Iniciar una conversación' })).toBeTruthy();
  });

  it('keeps the active tab when switching to another spec', () => {
    const card = openTab('Tareas');
    fireEvent.click(screen.getByRole('button', { name: 'Todas3' }));
    fireEvent.click(screen.getByRole('button', { name: /Plan futuro/ }));
    expect(within(screen.getByTestId('spec-card')).getByRole('tab', { name: 'Tareas' }).getAttribute('aria-selected')).toBe('true');
    expect(card).toBeTruthy();
  });
});

describe('right panel', () => {
  it('offers Actividad and Detalles for the selected spec', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Pagos/ }));
    const right = document.querySelector('[data-studio-panel="right"]') as HTMLElement;
    expect(within(right).getByText('Todavía no hay actividad en esta spec.')).toBeTruthy();
    fireEvent.click(within(right).getByRole('radio', { name: 'Detalles' }));
    expect(within(right).getByText('sdd/specs/spec-dev-001-pagos')).toBeTruthy();
    expect(within(right).getByRole('button', { name: 'Abrir spec-dev-000-base' })).toBeTruthy();
  });
});
