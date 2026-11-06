import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { WorkspaceSnapshot } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from './BridgeProvider';
import { EcosystemDashboard } from './mission-control/EcosystemDashboard';
import { StudioHeader } from './StudioHeader';

const snapshot: WorkspaceSnapshot = {
  project: 'p', profile: 'team', kitVersion: null, gateMode: 'block', pricing: null, stale: [], agents: [], skills: [],
  specs: [
    { id: 'spec-a', title: 'A', status: 'in-progress', folder: '', module: null, app: 'apps/a', dependsOn: [] },
    { id: 'spec-b', title: 'B', status: 'in-progress', folder: '', module: null, app: 'apps/b', dependsOn: [] },
  ],
  cycles: [
    { specId: 'spec-a', cycle: 'cycle-01', status: 'in-progress', flow: 'lite', apps: ['apps/a'], tasks: [], tasksTotal: 5, tasksDone: 2 },
    { specId: 'spec-b', cycle: 'cycle-02', status: 'in-progress', flow: 'full', apps: ['apps/b'], tasks: [], tasksTotal: 4, tasksDone: 1 },
  ],
  fixes: [{ id: 'FIX-9', title: 'Typo', status: 'pending', severity: 'low', specId: null, createdAt: null, closedAt: null }],
  sessions: [
    { sessionId: 'claude-code-abcdef12', unit: { kind: 'cycle', specId: 'spec-a', cycle: 'cycle-01' }, harness: 'claude-code', source: 'branch', worktree: '/r', boundAt: '2026-11-06T10:00:00Z', updatedAt: '2026-11-06T10:00:00Z' },
    { sessionId: 'studio-9f8e7d6c-1111', unit: { kind: 'fix', fixId: 'FIX-9' }, harness: 'studio', source: 'studio', worktree: '/r', boundAt: '2026-11-06T10:00:00Z', updatedAt: '2026-11-06T10:00:00Z' },
  ],
};

function mount(ui: React.ReactElement, snap: WorkspaceSnapshot | null = snapshot) {
  const store = createStudioStore();
  if (snap) store.getState().setSnapshot(snap);
  const value = { client: null, store, connection: { status: 'open' } } as unknown as BridgeContextValue;
  return render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>{ui}</BridgeContext.Provider>
    </I18nProvider>,
  );
}

afterEach(cleanup);

describe('StudioHeader open units', () => {
  it('shows a compact count of everything in progress and no popover until clicked', () => {
    mount(<StudioHeader />);
    expect(screen.getByTestId('open-units-pill')).toHaveTextContent('3 en curso');
    expect(screen.queryByTestId('open-units-popover')).toBeNull();
  });

  it('lists every cycle and open fix with the session working on each, and closes with Escape', () => {
    mount(<StudioHeader />);
    fireEvent.click(screen.getByTestId('open-units-pill'));
    const popover = screen.getByTestId('open-units-popover');
    const rows = within(popover).getAllByTestId('open-unit');
    expect(rows.map((r) => r.getAttribute('data-unit'))).toEqual(['spec-a/cycle-01', 'spec-b/cycle-02', 'FIX-9']);
    expect(within(rows[0]!).getByTestId('unit-session')).toHaveTextContent('claude-code · claude-c');
    expect(within(rows[1]!).queryByTestId('unit-session')).toBeNull();
    expect(rows[1]).toHaveTextContent('sin sesión atada');
    expect(within(rows[2]!).getByTestId('unit-session')).toHaveTextContent('studio · 9f8e7d6c');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('open-units-popover')).toBeNull();
  });

  it('works against an older bridge that sends no sessions', () => {
    mount(<StudioHeader />, { ...snapshot, sessions: undefined });
    fireEvent.click(screen.getByTestId('open-units-pill'));
    expect(screen.queryAllByTestId('unit-session')).toEqual([]);
    expect(screen.getAllByTestId('open-unit')).toHaveLength(3);
  });

  it('renders no pill when nothing is in progress', () => {
    mount(<StudioHeader />, { ...snapshot, cycles: [], fixes: [] });
    expect(screen.queryByTestId('open-units-pill')).toBeNull();
  });
});

describe('EcosystemDashboard open units', () => {
  it('lists all in-progress cycles and open fixes with their sessions', () => {
    mount(<EcosystemDashboard />);
    const section = screen.getByTestId('open-units-section');
    const rows = within(section).getAllByTestId('open-unit');
    expect(rows.map((r) => r.getAttribute('data-unit'))).toEqual(['spec-a/cycle-01', 'spec-b/cycle-02', 'FIX-9']);
    expect(rows[0]).toHaveTextContent('lite');
    expect(rows[0]).toHaveTextContent('2/5 tasks');
    expect(rows[2]).toHaveTextContent('Typo');
    expect(within(section).getAllByTestId('unit-session').map((s) => s.textContent)).toEqual(['claude-code · claude-c', 'studio · 9f8e7d6c']);
  });

  it('summarises several cycles in the gate pill and tags each app with its own cycle', async () => {
    mount(<EcosystemDashboard />);
    expect(screen.getByText(/^2 en curso$/)).toBeInTheDocument();
    expect(await screen.findByText('Activo en cycle-01')).toBeInTheDocument();
    expect(await screen.findByText('Activo en cycle-02')).toBeInTheDocument();
  });

  it('shows the empty state without open work', () => {
    mount(<EcosystemDashboard />, { ...snapshot, cycles: [], fixes: [] });
    expect(within(screen.getByTestId('open-units-section')).getByText('No hay ciclos en curso ni fixes abiertos')).toBeInTheDocument();
  });
});
