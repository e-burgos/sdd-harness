import { fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceSnapshot, Presence } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from './BridgeProvider';
import { Connected } from './WorkspaceApp';

const mockSnapshot: WorkspaceSnapshot = {
  project: 'sdd-harness',
  profile: 'team',
  kitVersion: '0.16.0',
  specs: [
    {
      id: 'spec-e-burgos-003-studio-mission-control',
      title: 'Studio Mission Control',
      status: 'in-progress',
      folder: 'sdd/specs/spec-e-burgos-003-studio-mission-control',
      module: 'studio-mission-control',
      app: 'studio',
      dependsOn: [],
    },
  ],
  cycles: [
    {
      specId: 'spec-e-burgos-003-studio-mission-control',
      cycle: 'cycle-01',
      status: 'in-progress',
      flow: 'lite',
      apps: ['studio'],
      tasks: [],
      tasksTotal: 7,
      tasksDone: 1,
    },
  ],
  fixes: [],
  agents: [],
  skills: [],
  gateMode: 'block',
  pricing: {
    currency: 'USD',
    traditional_hourly_rate: 50,
    model_prices_per_mtok: {
      'gemini/pro': { input: 2, output: 12 },
    },
  },
  stale: [],
};

const mockPresence: Presence[] = [
  { agent: 'sdd-orchestrator', state: 'working', tool: 'coordinate', threadId: null, specId: null },
];

function mountConnected() {
  const store = createStudioStore();
  store.getState().setSnapshot(mockSnapshot);
  store.getState().setPresence(mockPresence);
  const value = {
    client: { request: vi.fn().mockResolvedValue({}), supports: () => false },
    store,
    connection: { status: 'open' },
    pairing: { port: 3100, token: 'secret' },
    authMode: 'local',
    apiKeySource: null,
    setApiKey: vi.fn(),
    syncError: null,
    retrySync: vi.fn(),
    snapshot: mockSnapshot,
    presence: mockPresence,
  } as unknown as BridgeContextValue;

  return render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <Connected />
      </BridgeContext.Provider>
    </I18nProvider>,
  );
}

describe('WorkspaceApp / Connected Navigation', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the header and the module rail on Home by default', () => {
    mountConnected();
    expect(screen.getByText('SDD Studio')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Módulos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: '# general' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mapa de agentes/i })).not.toBeInTheDocument();
  });

  it('switches modules from the rail and keeps Mission Control reachable', () => {
    mountConnected();

    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }));
    expect(screen.getByRole('button', { name: 'Mapa' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('agent-map-canvas')).toBeInTheDocument();
    expect(screen.getByText('Topología del Enjambre')).toBeInTheDocument();
    expect(screen.getAllByText('Clara').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Métricas' }));
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ecosistema' }));
    expect(screen.getByTestId('ecosystem-dashboard')).toBeInTheDocument();
    expect(screen.getByText('Ecosistema del Repositorio')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Telemetría' }));
    expect(screen.getByTestId('live-telemetry-hud')).toBeInTheDocument();
    expect(screen.getByText('Telemetría de Misión & Tokens')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Inicio' }));
    expect(screen.getByRole('heading', { name: '# general' })).toBeInTheDocument();
  });

  it('persists the active module per project and restores it on reload', () => {
    const first = mountConnected();
    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }));
    first.unmount();
    mountConnected();
    expect(screen.getByRole('button', { name: 'Mapa' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('agent-map-canvas')).toBeInTheDocument();
  });
});
