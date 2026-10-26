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
  it('renders the map canvas with Clara, agents and SDD Gate cards', () => {
    const onOpenDm = vi.fn();
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentMapCanvas onOpenDm={onOpenDm} />
      </BridgeContext.Provider>
    );

    expect(screen.getByTestId('agent-map-canvas')).toBeInTheDocument();
    expect(screen.getAllByText('Clara').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Vulcan').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Aurora').length).toBeGreaterThanOrEqual(1);

    expect(screen.getByTestId('gate-card-gate-a')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-gate-b')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-contexto-gate')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-fix-gate')).toBeInTheDocument();
  });

  it('switches gate filters between cycle, transversal and all', () => {
    const onOpenDm = vi.fn();
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentMapCanvas onOpenDm={onOpenDm} />
      </BridgeContext.Provider>
    );

    const transversalBtn = screen.getByText('Transversales (2)');
    fireEvent.click(transversalBtn);
    expect(screen.getByTestId('gate-card-regla-cero')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-memoria-gate')).toBeInTheDocument();
    expect(screen.queryByTestId('gate-card-gate-a')).not.toBeInTheDocument();

    const allBtn = screen.getByText('Todas (6)');
    fireEvent.click(allBtn);
    expect(screen.getByTestId('gate-card-regla-cero')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-gate-a')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-gate-b')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-contexto-gate')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-fix-gate')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-memoria-gate')).toBeInTheDocument();
  });

  it('opens gate inspector drawer on gate card click', () => {
    const onOpenDm = vi.fn();
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentMapCanvas onOpenDm={onOpenDm} />
      </BridgeContext.Provider>
    );

    const gateACard = screen.getByTestId('gate-card-gate-a');
    fireEvent.click(gateACard);

    expect(screen.getByTestId('gate-inspector-drawer')).toBeInTheDocument();
    expect(screen.getAllByText('SPEC GATE A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Propósito del Gate')).toBeInTheDocument();
    expect(screen.getByText('Reglas & Checklist Canónica')).toBeInTheDocument();
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

  it('renders live inter-agent dialogue bubble and comms console in real time', () => {
    const onOpenDm = vi.fn();
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentMapCanvas onOpenDm={onOpenDm} />
      </BridgeContext.Provider>
    );

    expect(screen.getByTestId('swarm-dialogue-bubble')).toBeInTheDocument();
    expect(screen.getByText('COMMS EN VIVO')).toBeInTheDocument();
    expect(screen.getAllByText(/Ejecutando spec-gate/).length).toBeGreaterThanOrEqual(1);
  });

  it('toggles between real-time execution mode and demo flow', () => {
    const onOpenDm = vi.fn();
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentMapCanvas onOpenDm={onOpenDm} />
      </BridgeContext.Provider>
    );

    const toggleBtn = screen.getByText(/TIEMPO REAL \(1\)/);
    fireEvent.click(toggleBtn);
    expect(screen.getByText('DEMO SDD')).toBeInTheDocument();
    expect(screen.getAllByText(/Regla Cero verificada/).length).toBeGreaterThanOrEqual(1);

    const nextBtn = screen.getByText('⏭ Siguiente');
    fireEvent.click(nextBtn);
    expect(screen.getAllByText(/SPEC GATE A evaluado/).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByText('DEMO SDD'));
    expect(screen.getByText(/TIEMPO REAL \(1\)/)).toBeInTheDocument();
  });

  it('provides zoom in, zoom out, and reset controls in the floating toolbar', () => {
    const onOpenDm = vi.fn();
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentMapCanvas onOpenDm={onOpenDm} />
      </BridgeContext.Provider>
    );

    expect(screen.getByTestId('zoom-toolbar')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();

    const zoomInBtn = screen.getByTitle('Acercar (+)');
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('115%')).toBeInTheDocument();

    const zoomOutBtn = screen.getByTitle('Alejar (-)');
    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('85%')).toBeInTheDocument();

    const resetBtn = screen.getByTitle('Restablecer posición y zoom (100%)');
    fireEvent.click(resetBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('collapses and expands the side drawer to adjust diagram space', () => {
    const onOpenDm = vi.fn();
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentMapCanvas onOpenDm={onOpenDm} />
      </BridgeContext.Provider>
    );

    expect(screen.getByTestId('agent-inspector-drawer')).toBeInTheDocument();

    const closeBtn = screen.getByTitle('Contraer panel');
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId('agent-inspector-drawer')).not.toBeInTheDocument();
    expect(screen.getByTestId('open-panel-button')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-panel-button'));
    expect(screen.getByTestId('agent-inspector-drawer')).toBeInTheDocument();
  });
});
