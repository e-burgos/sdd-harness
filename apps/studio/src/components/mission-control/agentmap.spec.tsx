import { render, screen, fireEvent } from '@testing-library/react';
import { AgentMapCanvas } from './AgentMapCanvas';
import { BridgeContext } from '../BridgeProvider';
import { createStudioStore } from '@/lib/store/store';

const store = createStudioStore();
store.getState().setSnapshot({
  project: 'test-monorepo',
  profile: 'team',
  kitVersion: '0.16.1',
  specs: [],
  cycles: [],
  fixes: [],
  agents: [],
  skills: [],
  gateMode: 'block',
  pricing: null,
  stale: [],
});
store.getState().setPresence([
  { agent: 'sdd-orchestrator', state: 'working', threadId: 't-1', specId: 's-1', tool: 'spec-gate' },
  { agent: 'sdd-implementor-back', state: 'idle', threadId: null, specId: null, tool: null },
]);

const mockBridgeValue: any = {
  connection: { status: 'open' },
  pairing: { port: 3100, token: 'abc' },
  store,
  syncError: null,
  retrySync: () => {},
};

describe('AgentMapCanvas', () => {
  it('renders the map canvas with Clara and agents', () => {
    const onOpenDm = vi.fn();
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentMapCanvas onOpenDm={onOpenDm} />
      </BridgeContext.Provider>
    );

    expect(screen.getByTestId('agent-map-canvas')).toBeInTheDocument();
    expect(screen.getAllByText('Clara').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Vulcan')).toBeInTheDocument();
    expect(screen.getByText('Aurora')).toBeInTheDocument();
  });

  it('opens drawer on node selection and triggers DM callback', () => {
    const onOpenDm = vi.fn();
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentMapCanvas onOpenDm={onOpenDm} />
      </BridgeContext.Provider>
    );

    expect(screen.getByTestId('agent-inspector-drawer')).toBeInTheDocument();
    const dmButton = screen.getByText(/Abrir chat directo con Clara/);
    fireEvent.click(dmButton);
    expect(onOpenDm).toHaveBeenCalledWith('sdd-orchestrator');
  });

  it('renders live inter-agent dialogue bubble and comms console', () => {
    const onOpenDm = vi.fn();
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentMapCanvas onOpenDm={onOpenDm} />
      </BridgeContext.Provider>
    );

    expect(screen.getByTestId('swarm-dialogue-bubble')).toBeInTheDocument();
    expect(screen.getByText('COMMS EN VIVO')).toBeInTheDocument();
    expect(screen.getAllByText(/Sophia, iniciamos el ciclo/).length).toBeGreaterThanOrEqual(1);

    const nextBtn = screen.getByText('⏭ Siguiente');
    fireEvent.click(nextBtn);
    expect(screen.getAllByText(/Brief procesado/).length).toBeGreaterThanOrEqual(1);
  });
});
