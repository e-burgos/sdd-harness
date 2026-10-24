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

  it('renders StudioHeader and defaults to workspace view', () => {
    mountConnected();
    expect(screen.getByText('SDD Studio')).toBeInTheDocument();
    // Default workspace channel heading should be present
    expect(screen.getByRole('heading', { name: '# general' })).toBeInTheDocument();
  });

  it('switches between views when clicking header buttons', () => {
    mountConnected();

    // Switch to Agent Map view
    const mapButton = screen.getByRole('button', { name: /Mapa de agentes/i });
    fireEvent.click(mapButton);
    expect(screen.getByTestId('agent-map-canvas')).toBeInTheDocument();
    expect(screen.getByText('Topología del Enjambre')).toBeInTheDocument();
    expect(screen.getAllByText('Clara').length).toBeGreaterThan(0);

    // Switch to Ecosystem view
    const ecoButton = screen.getByRole('button', { name: /Ecosistema/i });
    fireEvent.click(ecoButton);
    expect(screen.getByTestId('ecosystem-dashboard')).toBeInTheDocument();
    expect(screen.getByText('Ecosistema del Repositorio')).toBeInTheDocument();

    // Switch to Telemetry view
    const telemButton = screen.getByRole('button', { name: /Telemetría/i });
    fireEvent.click(telemButton);
    expect(screen.getByTestId('live-telemetry-hud')).toBeInTheDocument();
    expect(screen.getByText('Telemetría de Misión & Tokens')).toBeInTheDocument();

    // Switch back to Workspace
    const wsButton = screen.getByRole('button', { name: /Workspace/i });
    fireEvent.click(wsButton);
    expect(screen.getByRole('heading', { name: '# general' })).toBeInTheDocument();
  });
});
