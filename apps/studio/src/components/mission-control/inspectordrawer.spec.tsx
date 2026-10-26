import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentInspectorDrawer } from './AgentInspectorDrawer';
import { BridgeContext } from '../BridgeProvider';
import { createStudioStore } from '@/lib/store/store';

const store = createStudioStore();
const mockClient = {
  request: vi.fn().mockResolvedValue({ id: 'thread-1' }),
  supports: vi.fn().mockReturnValue(true),
};

const mockBridgeValue: any = {
  client: mockClient,
  connection: { status: 'open' },
  pairing: { port: 3100, token: 'abc' },
  store,
  syncError: null,
  retrySync: () => {},
};

describe('AgentInspectorDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders drawer for Clara with full personality, role, live chat feed and DM button', () => {
    const onClose = vi.fn();
    const onOpenDm = vi.fn();

    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentInspectorDrawer
          agentId="sdd-orchestrator"
          presence={{ agent: 'sdd-orchestrator', state: 'working', threadId: 't-1', specId: 's-1', tool: 'git status' }}
          onClose={onClose}
          onOpenDm={onOpenDm}
        />
      </BridgeContext.Provider>
    );

    expect(screen.getByTestId('agent-inspector-drawer')).toBeInTheDocument();
    expect(screen.getByText('LEADER')).toBeInTheDocument();
    expect(screen.getByText(/Directora de Orquesta/)).toBeInTheDocument();
    expect(screen.getByText(/git status/)).toBeInTheDocument();
    expect(screen.getByTestId('live-agent-chat-feed')).toBeInTheDocument();

    const dmBtn = screen.getByText(/Abrir chat directo con Clara/);
    fireEvent.click(dmBtn);
    expect(onOpenDm).toHaveBeenCalledWith('sdd-orchestrator');
    expect(onClose).toHaveBeenCalled();
  });

  it('sends quick message to the agent via bridge client request on form submit', async () => {
    const onOpenDm = vi.fn();

    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentInspectorDrawer
          agentId="sdd-orchestrator"
          presence={{ agent: 'sdd-orchestrator', state: 'idle', threadId: null, specId: null, tool: null }}
          onClose={() => {}}
          onOpenDm={onOpenDm}
        />
      </BridgeContext.Provider>
    );

    const input = screen.getByPlaceholderText(/Escribir a Clara/);
    fireEvent.change(input, { target: { value: 'Hola Clara, iniciemos la tarea' } });

    const submitBtn = screen.getByTitle(/Enviar mensaje a Clara/);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          cmd: 'thread.create',
          channelId: 'dm:sdd-orchestrator',
          text: 'Hola Clara, iniciemos la tarea',
        })
      );
    });

    expect(onOpenDm).toHaveBeenCalledWith('sdd-orchestrator');
  });

  it('displays última actividad when agent is idle and no live dialogue exists', () => {
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentInspectorDrawer
          agentId="sdd-architect"
          presence={{ agent: 'sdd-architect', state: 'idle', threadId: null, specId: null, tool: null }}
          onClose={() => {}}
          onOpenDm={() => {}}
        />
      </BridgeContext.Provider>
    );

    expect(screen.getByText(/Última Actividad/)).toBeInTheDocument();
    expect(screen.getByText(/Sin actividad registrada aún para Daedalus/)).toBeInTheDocument();
  });

  it('displays demo mode simulation when mode is demo', () => {
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentInspectorDrawer
          agentId="sdd-orchestrator"
          mode="demo"
          presence={{ agent: 'sdd-orchestrator', state: 'idle', threadId: null, specId: null, tool: null }}
          onClose={() => {}}
          onOpenDm={() => {}}
        />
      </BridgeContext.Provider>
    );

    expect(screen.getByText(/Simulación Enjambre/)).toBeInTheDocument();
  });

  it('renders swarm comms tab when agentId is null instead of returning null', () => {
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentInspectorDrawer
          agentId={null}
          dialogueHistory={[
            {
              id: 'test-1',
              from: 'sdd-orchestrator',
              to: 'sdd-functional',
              text: 'Iniciando verificación de enjambre',
              phase: 'orchestration',
              isLive: true,
            },
          ]}
          onClose={() => {}}
          onOpenDm={() => {}}
        />
      </BridgeContext.Provider>
    );

    expect(screen.getByTestId('agent-inspector-drawer')).toBeInTheDocument();
    expect(screen.getByText(/Comms del Enjambre/)).toBeInTheDocument();
    expect(screen.getByText(/Iniciando verificación de enjambre/)).toBeInTheDocument();
  });

  it('allows toggling between Agente and Enjambre tabs', () => {
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentInspectorDrawer
          agentId="sdd-orchestrator"
          dialogueHistory={[
            {
              id: 'test-2',
              from: 'sdd-planner',
              to: 'sdd-architect',
              text: 'Contratos definidos',
              phase: 'architecture',
              gateId: 'gate-b',
            },
          ]}
          onClose={() => {}}
          onOpenDm={() => {}}
        />
      </BridgeContext.Provider>
    );

    expect(screen.getByTestId('live-agent-chat-feed')).toBeInTheDocument();

    const swarmTabBtn = screen.getByText('Enjambre');
    fireEvent.click(swarmTabBtn);

    expect(screen.getByText(/Contratos definidos/)).toBeInTheDocument();
    expect(screen.getByText('GATE-B')).toBeInTheDocument();

    const agentTabBtn = screen.getByText('Clara');
    fireEvent.click(agentTabBtn);

    expect(screen.getByTestId('live-agent-chat-feed')).toBeInTheDocument();
  });

  it('displays provider, session, location banner, and triggers auto-scroll on swarm tab', () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentInspectorDrawer
          agentId={null}
          dialogueHistory={[
            {
              id: 'd-1',
              from: 'sdd-orchestrator',
              to: 'user',
              text: 'Primer mensaje',
              phase: 'orchestration',
              timestamp: '2026-10-24T12:00:00.000Z',
              provider: 'claude',
              engineSessionId: 'test-session-123456789',
              seq: 1,
            },
            {
              id: 'd-2',
              from: 'sdd-reviewer',
              to: 'sdd-orchestrator',
              text: 'Último mensaje del enjambre',
              phase: 'review',
              gateId: 'contexto-gate',
              timestamp: '2026-10-24T12:05:00.000Z',
              provider: 'claude',
              engineSessionId: 'test-session-123456789',
              seq: 2,
            },
          ]}
          onClose={() => {}}
          onOpenDm={() => {}}
        />
      </BridgeContext.Provider>
    );

    // 1. Verificación de ubicación donde está parado el enjambre (Req 6)
    expect(screen.getByText(/PARADO EN:/)).toBeInTheDocument();

    // 2. Verificación de proveedor y sesión (Req 4 & 5)
    expect(screen.getByText(/Claude Code/)).toBeInTheDocument();
    expect(screen.getByTitle(/test-session-123456789/)).toBeInTheDocument();

    // 3. Verificación de fecha y hora del mensaje (Req 3)
    expect(screen.getAllByText(/24\/10/).length).toBe(2);

    // 4. Verificación de selectores de Spec Gate y Fix Gate (Req 8 & 9)
    expect(screen.getByText(/Spec Gate/)).toBeInTheDocument();
    expect(screen.getByText(/Fix Gate/)).toBeInTheDocument();

    // 5. Verificación de auto-scroll (Req 1)
    expect(screen.getByTestId('swarm-messages-end')).toBeInTheDocument();
  });

  it('displays generated documents for the touched agent (Requirement 7)', () => {
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentInspectorDrawer
          agentId="sdd-orchestrator"
          onClose={() => {}}
          onOpenDm={() => {}}
        />
      </BridgeContext.Provider>
    );

    expect(screen.getByText(/Documentos Generados/)).toBeInTheDocument();
    expect(screen.getByText(/plan.md/)).toBeInTheDocument();
    expect(screen.getByText(/cycle.json/)).toBeInTheDocument();
  });

  it('opens document viewer modal when a generated document is clicked', async () => {
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentInspectorDrawer
          agentId="sdd-orchestrator"
          onClose={() => {}}
          onOpenDm={() => {}}
        />
      </BridgeContext.Provider>
    );

    const docCard = screen.getByText(/plan.md/);
    fireEvent.click(docCard);

    expect(await screen.findByTestId('document-viewer-modal')).toBeInTheDocument();
    expect(screen.getByText('Renderizado')).toBeInTheDocument();
    expect(screen.getByText('Crudo / Fuente')).toBeInTheDocument();

    const closeBtn = screen.getByLabelText(/Cerrar modal de documento/);
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId('document-viewer-modal')).not.toBeInTheDocument();
  });

  it('changes conversation, session id and provider when switching spec in dropdown', () => {
    const onSelectSpecId = vi.fn();
    render(
      <BridgeContext.Provider value={mockBridgeValue}>
        <AgentInspectorDrawer
          agentId={null}
          onSelectSpecId={onSelectSpecId}
          onClose={() => {}}
          onOpenDm={() => {}}
        />
      </BridgeContext.Provider>
    );

    // Initial state: Spec 004 (Claude)
    expect(screen.getByText(/Claude Code/)).toBeInTheDocument();
    expect(screen.getByText(/Regla Cero verificada/)).toBeInTheDocument();

    // Select Spec 003 (Mission Control - Gemini)
    const select = screen.getByDisplayValue(/004-studio-gates-topology/);
    fireEvent.change(select, { target: { value: 'spec-e-burgos-003-studio-mission-control' } });

    expect(onSelectSpecId).toHaveBeenCalledWith('spec-e-burgos-003-studio-mission-control');
    expect(screen.getByText(/Google Gemini/)).toBeInTheDocument();
    expect(screen.getByText(/Iniciamos SPEC-003: Mission Control/)).toBeInTheDocument();
    expect(screen.getByTitle(/session-spec-003-gemini/)).toBeInTheDocument();
  });
});
