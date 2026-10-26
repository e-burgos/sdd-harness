import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CycleSummary } from '@sdd-studio/protocol';
import { AgentInspectorDrawer } from './AgentInspectorDrawer';
import { BridgeContext } from '../BridgeProvider';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import type { ConversationDialogue, ConversationView } from '@/lib/conversation';

const cycles: CycleSummary[] = [
  { specId: 'spec-real-1', cycle: 'cycle-01', status: 'in-progress', flow: 'full', apps: [], tasks: [], tasksTotal: 1, tasksDone: 0 },
];

function makeStore() {
  const store = createStudioStore();
  store.getState().setSnapshot({
    project: 'p',
    profile: 'team',
    kitVersion: null,
    specs: [{ id: 'spec-real-1', title: 'Real', status: 'in-progress', folder: 'f', module: null, app: null, dependsOn: [] }],
    cycles,
    fixes: [],
    agents: [],
    skills: [],
    gateMode: 'block',
    pricing: null,
    stale: [],
  });
  return store;
}

const mockClient = {
  request: vi.fn().mockResolvedValue({}),
  supports: vi.fn().mockReturnValue(true),
};

const bridge: any = {
  client: mockClient,
  connection: { status: 'open' },
  pairing: { port: 3100, token: 'abc' },
  store: makeStore(),
  syncError: null,
  retrySync: () => {},
};

const dialogue = (seq: number, from: string, to: string | null, text: string, patch: Partial<ConversationDialogue> = {}): ConversationDialogue => ({
  id: `d${seq}`,
  seq,
  kind: 'message',
  from,
  to,
  text,
  isLive: false,
  ...patch,
});

const conversation = (patch: Partial<ConversationView> = {}): ConversationView => ({
  threadId: 't-1',
  participants: [{ agentId: 'sdd-orchestrator', events: 2 }],
  dialogues: [dialogue(1, 'sdd-orchestrator', 'user', 'Primer mensaje'), dialogue(2, 'sdd-reviewer', 'user', 'Último mensaje', { gateId: 'contexto-gate' })],
  specs: [{ specId: 'spec-real-1', cycle: 'cycle-01', source: 'event', known: true }],
  fixes: [],
  documents: [{ path: 'sdd/specs/spec-real-1/cycles/cycle-01/plan.md', name: 'plan.md', specId: 'spec-real-1', fixId: null, modified: true }],
  engineSessionId: 'real-session-0001',
  provider: 'claude',
  isEmpty: false,
  ...patch,
});

const renderDrawer = (props: Partial<Parameters<typeof AgentInspectorDrawer>[0]> = {}) =>
  render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={bridge}>
        <AgentInspectorDrawer agentId="sdd-orchestrator" conversation={null} onClose={() => {}} onOpenDm={() => {}} {...props} />
      </BridgeContext.Provider>
    </I18nProvider>,
  );

describe('AgentInspectorDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('renders the agent profile, the live feed and the direct message button', () => {
    const onClose = vi.fn();
    const onOpenDm = vi.fn();
    renderDrawer({ presence: { agent: 'sdd-orchestrator', state: 'working', threadId: 't-1', specId: null, tool: 'git status' }, onClose, onOpenDm });

    expect(screen.getByTestId('agent-inspector-drawer')).toBeInTheDocument();
    expect(screen.getByText('LEADER')).toBeInTheDocument();
    expect(screen.getByText(/git status/)).toBeInTheDocument();
    expect(screen.getByTestId('live-agent-chat-feed')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Abrir nuevo chat con Clara/));
    expect(onOpenDm).toHaveBeenCalledWith('sdd-orchestrator');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the empty feed state without a conversation', () => {
    renderDrawer({ agentId: 'sdd-architect' });
    expect(screen.getByTestId('live-agent-chat-feed-empty')).toHaveTextContent('Sin actividad todavía');
    expect(screen.queryByTestId('conversation-session-info')).toBeNull();
  });

  it('shows the real session and provider of the conversation', () => {
    renderDrawer({ conversation: conversation() });
    expect(screen.getByTestId('conversation-session')).toHaveTextContent('real-session-0001');
    expect(screen.getByTestId('conversation-provider')).toHaveTextContent('Claude Code');
  });

  it('shows that no session exists yet and distinguishes a bridge that does not report it', () => {
    const { unmount } = renderDrawer({ conversation: conversation({ engineSessionId: null }) });
    expect(screen.getByTestId('conversation-session')).toHaveTextContent('Sin sesión todavía');
    unmount();
    renderDrawer({ conversation: conversation({ engineSessionId: undefined, provider: undefined }) });
    expect(screen.getByTestId('conversation-session')).toHaveTextContent('sesión no informada');
    expect(screen.getByTestId('conversation-provider')).toHaveTextContent('proveedor no informado');
  });

  it('keeps the related documents card collapsed until Ver info opens it and remembers the choice', () => {
    const { unmount } = renderDrawer({ conversation: conversation() });
    expect(screen.queryByTestId('related-documents-body')).toBeNull();
    fireEvent.click(screen.getByText('Ver info'));
    expect(screen.getByTestId('related-documents-body')).toBeInTheDocument();
    unmount();
    renderDrawer({ conversation: conversation() });
    expect(screen.getByTestId('related-documents-body')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('related-documents-toggle'));
    expect(screen.queryByTestId('related-documents-body')).toBeNull();
    expect(screen.getByText('Ver info')).toBeInTheDocument();
  });

  it('lists the related specs of the conversation with their real documents', () => {
    renderDrawer({ conversation: conversation() });
    fireEvent.click(screen.getByText('Ver info'));
    const row = screen.getByTestId('related-spec-spec-real-1');
    expect(row).toHaveTextContent('spec-real-1');
    expect(row.querySelectorAll('button')).toHaveLength(1);
    expect(row).toHaveTextContent('plan.md');
  });

  it('shows the empty related state when the conversation references nothing', () => {
    renderDrawer({ conversation: conversation({ specs: [], fixes: [], documents: [] }) });
    fireEvent.click(screen.getByText('Ver info'));
    expect(screen.getByTestId('related-documents-empty')).toBeInTheDocument();
  });

  it('opens the document viewer when a related document is clicked and closes it', async () => {
    renderDrawer({ conversation: conversation() });
    fireEvent.click(screen.getByText('Ver info'));
    const button = screen.getByTestId('related-spec-spec-real-1').querySelector('button') as HTMLElement;
    fireEvent.click(button);

    expect(await screen.findByTestId('document-viewer-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Cerrar modal de documento/));
    expect(screen.queryByTestId('document-viewer-modal')).not.toBeInTheDocument();
  });

  it('renders the swarm tab with the conversation dialogues when no agent is selected', () => {
    renderDrawer({ agentId: null, conversation: conversation() });
    expect(screen.getByText(/Comms del Enjambre \(2\)/)).toBeInTheDocument();
    expect(screen.getByText('Primer mensaje')).toBeInTheDocument();
    expect(screen.getByText('Último mensaje')).toBeInTheDocument();
    expect(screen.getByText('CONTEXTO-GATE')).toBeInTheDocument();
    expect(screen.getByTestId('swarm-messages-end')).toBeInTheDocument();
    expect(screen.queryByText(/PARADO EN/)).toBeNull();
    expect(screen.queryByText(/Spec Gate/)).toBeNull();
  });

  it('shows the empty swarm state for an empty conversation and for no conversation', () => {
    const { unmount } = renderDrawer({ agentId: null, conversation: conversation({ dialogues: [], isEmpty: true }) });
    expect(screen.getByTestId('swarm-comms-empty-state')).toHaveTextContent('Sin actividad todavía');
    unmount();
    renderDrawer({ agentId: null, conversation: null });
    expect(screen.getByTestId('swarm-comms-empty-state')).toHaveTextContent('Todavía no hay conversaciones');
  });

  it('reports the agent and dialogue when a swarm message is clicked', () => {
    const onSelectAgent = vi.fn();
    const onSelectDialogue = vi.fn();
    renderDrawer({ agentId: null, conversation: conversation(), onSelectAgent, onSelectDialogue });
    fireEvent.click(screen.getByText('Último mensaje'));
    expect(onSelectAgent).toHaveBeenCalledWith('sdd-reviewer');
    expect(onSelectDialogue).toHaveBeenCalledWith(expect.objectContaining({ id: 'd2' }));
  });

  it('toggles between the agent and swarm tabs', () => {
    renderDrawer({ conversation: conversation() });
    expect(screen.getByTestId('live-agent-chat-feed')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Enjambre'));
    expect(screen.getByText('Último mensaje')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clara' }));
    expect(screen.getByTestId('live-agent-chat-feed')).toBeInTheDocument();
  });

  it('creates a direct conversation from the quick message when nothing is selected', async () => {
    const created = {
      id: 'thread-9',
      channelId: 'dm:sdd-orchestrator',
      title: 'x',
      agent: 'sdd-orchestrator',
      options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' },
      status: 'running',
      createdAt: '2026-01-01T00:00:00Z',
      lastActivity: '2026-01-01T00:00:00Z',
      link: { target: { kind: 'none' }, source: 'legacy' },
      pendingCount: 0,
    };
    mockClient.request.mockResolvedValueOnce(created);
    const onPickConversation = vi.fn();
    renderDrawer({ onPickConversation });

    fireEvent.change(screen.getByPlaceholderText(/Escribir a Clara/), { target: { value: 'Hola' } });
    fireEvent.click(screen.getByTitle(/Enviar mensaje a Clara/));

    await waitFor(() => expect(mockClient.request).toHaveBeenCalledWith(expect.objectContaining({ cmd: 'thread.create', channelId: 'dm:sdd-orchestrator', text: 'Hola' })));
    await waitFor(() => expect(onPickConversation).toHaveBeenCalledWith('thread-9'));
  });
});
