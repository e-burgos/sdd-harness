import { render, screen } from '@testing-library/react';
import { EcosystemDashboard } from './EcosystemDashboard';
import { BridgeContext } from '../BridgeProvider';
import { createStudioStore } from '@/lib/store/store';

const store = createStudioStore();
store.getState().setSnapshot({
  project: 'test-monorepo',
  profile: 'team',
  kitVersion: '0.16.1',
  specs: [
    { id: 'spec-001', title: 'Studio Session UX', status: 'completed', folder: '', module: 'ux', app: 'apps/studio', dependsOn: [] },
    { id: 'spec-002', title: 'Studio UI Polish', status: 'in-progress', folder: '', module: 'polish', app: 'apps/studio', dependsOn: [] },
  ],
  cycles: [
    { specId: 'spec-001', cycle: 'cycle-01', status: 'completed', flow: 'full', apps: [], tasks: [], tasksTotal: 10, tasksDone: 10 },
    { specId: 'spec-002', cycle: 'cycle-01', status: 'in-progress', flow: 'lite', apps: [], tasks: [], tasksTotal: 5, tasksDone: 2 },
  ],
  fixes: [
    { id: 'FIX-001', title: 'CI fix', status: 'validated', severity: 'low', specId: null, createdAt: null, closedAt: null },
  ],
  agents: [],
  skills: [],
  gateMode: 'block',
  pricing: null,
  stale: [],
});

const mockBridgeValue: any = {
  connection: { status: 'open' },
  pairing: { port: 3100, token: 'abc' },
  store,
  syncError: null,
  retrySync: () => {},
};

describe('EcosystemDashboard', () => {
  it('renders headline KPIs, subprojects and roadmap', () => {
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <EcosystemDashboard />
      </BridgeContext.Provider>
    );

    expect(screen.getByTestId('ecosystem-dashboard')).toBeInTheDocument();
    expect(screen.getByText('Ecosistema del Repositorio')).toBeInTheDocument();
    expect(screen.getByText('apps/studio')).toBeInTheDocument();
    expect(screen.getByText('apps/studio-bridge')).toBeInTheDocument();
    expect(screen.getByText('libs/studio-protocol')).toBeInTheDocument();
    expect(screen.getByText('spec-001')).toBeInTheDocument();
    expect(screen.getByText('spec-002')).toBeInTheDocument();
  });
});
