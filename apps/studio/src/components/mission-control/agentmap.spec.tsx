import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Presence, ThreadInfo, ThreadEvent } from '@sdd-studio/protocol';
import { AgentMapCanvas } from './AgentMapCanvas';
import { BridgeContext } from '../BridgeProvider';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';

const info = (id: string, title: string, patch: Partial<ThreadInfo> = {}): ThreadInfo => ({
  id,
  channelId: 'general',
  title,
  agent: 'sdd-orchestrator',
  options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' },
  status: 'idle',
  createdAt: '2026-01-01T00:00:00Z',
  lastActivity: '2026-01-01T00:00:00Z',
  link: { target: { kind: 'none' }, source: 'legacy' },
  pendingCount: 0,
  ...patch,
});

const author = (agent: string) => ({ agent, parentToolUseId: null });

const conversationEvents = (agent: string, userText: string, replyText: string, readPath: string): { seq: number; event: ThreadEvent }[] => [
  { seq: 0, event: { type: 'user.message', text: userText } },
  { seq: 1, event: { type: 'tool.start', toolUseId: `tool-${agent}`, author: author(agent), tool: 'Read', summary: readPath } },
  { seq: 2, event: { type: 'message.start', messageId: `m-${agent}`, author: author(agent) } },
  { seq: 3, event: { type: 'message.delta', messageId: `m-${agent}`, text: replyText } },
  { seq: 4, event: { type: 'message.end', messageId: `m-${agent}` } },
];

interface Fixture {
  threads?: { info: ThreadInfo; events: { seq: number; event: ThreadEvent }[] }[];
  presence?: Presence[];
}

function bridgeWith({ threads = [], presence = [] }: Fixture = {}) {
  const store = createStudioStore();
  store.getState().setSnapshot({
    project: 'test-monorepo',
    profile: 'team',
    kitVersion: '0.16.1',
    specs: ['spec-alpha-1', 'spec-beta-2'].map((id) => ({ id, title: id, status: 'in-progress' as const, folder: id, module: null, app: null, dependsOn: [] })),
    cycles: [],
    fixes: [],
    agents: [],
    skills: [],
    gateMode: 'block',
    pricing: null,
    stale: [],
  });
  store.getState().setPresence(presence);
  store.getState().setThreads(threads.map((t) => t.info));
  for (const t of threads) store.getState().loadHistory(t.info.id, t.events);
  const value: any = {
    client: { request: vi.fn().mockResolvedValue([]), supports: vi.fn().mockReturnValue(true) },
    connection: { status: 'open' },
    pairing: { port: 3100, token: 'abc' },
    store,
    syncError: null,
    retrySync: () => {},
  };
  return value;
}

const mockBridgeValue = bridgeWith();

const twoConversations: Fixture = {
  threads: [
    {
      info: info('t-a', 'Conversación A', { lastActivity: '2026-02-01T00:00:00Z', engineSessionId: 'session-a-real', provider: 'claude' }),
      events: conversationEvents('sdd-planner', 'planificá la spec alfa', 'plan de alfa', 'sdd/specs/spec-alpha-1/cycles/cycle-01/plan.md'),
    },
    {
      info: info('t-b', 'Conversación B', { agent: 'sdd-architect', lastActivity: '2026-01-15T00:00:00Z', engineSessionId: 'session-b-real', provider: 'claude' }),
      events: conversationEvents('sdd-architect', 'diseñá la spec beta', 'diseño de beta', 'sdd/specs/spec-beta-2/cycles/cycle-01/architect.md'),
    },
  ],
};

function renderCanvas(fixture: Fixture = {}, handlers: { onOpenDm?: () => void; onNewConversation?: () => void } = {}) {
  const value = bridgeWith(fixture);
  const utils = render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <AgentMapCanvas onOpenDm={handlers.onOpenDm ?? (() => {})} onNewConversation={handlers.onNewConversation ?? (() => {})} />
      </BridgeContext.Provider>
    </I18nProvider>,
  );
  return { ...utils, value };
}

const dimmedNodes = (container: HTMLElement) => container.querySelectorAll('[data-participating="false"]').length;

describe('AgentMapCanvas', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('renders the map canvas with Clara, agents and SDD Gate cards', () => {
    renderCanvas();
    expect(screen.getByTestId('agent-map-canvas')).toBeInTheDocument();
    expect(screen.getAllByText('Clara').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Vulcan').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Aurora').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('gate-card-gate-a')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-gate-b')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-contexto-gate')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-fix-gate')).toBeInTheDocument();
  });

  it('shows the empty state with the new conversation button when there are no conversations', () => {
    const onNewConversation = vi.fn();
    renderCanvas({}, { onNewConversation });
    expect(screen.getByTestId('conversation-selector-empty')).toHaveTextContent('Todavía no hay conversaciones');
    expect(screen.getByTestId('swarm-comms-empty')).toHaveTextContent('Sin actividad todavía');
    expect(screen.queryByTestId('swarm-dialogue-bubble')).toBeNull();
    fireEvent.click(screen.getByTestId('new-conversation-button'));
    expect(onNewConversation).toHaveBeenCalledTimes(1);
  });

  it('places the conversation selector in the topology header beside the new conversation button', () => {
    renderCanvas(twoConversations);
    const header = screen.getByText('Topología del Enjambre').closest('div.flex.items-center.justify-between')!;
    expect(within(header as HTMLElement).getByTestId('conversation-select')).toBeInTheDocument();
    expect(within(header as HTMLElement).getByTestId('new-conversation-button')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('follows the most recent conversation and shows its real session', () => {
    renderCanvas(twoConversations);
    expect(screen.getByTestId('conversation-select')).toHaveValue('t-a');
    expect(screen.getByTestId('conversation-session')).toHaveTextContent('session-a-real');
    expect(screen.getByTestId('swarm-comms-console')).toHaveTextContent('plan de alfa');
  });

  it('switches between two conversations and changes dialogues, participants, session and related specs', () => {
    const { container } = renderCanvas(twoConversations);
    fireEvent.click(screen.getByText('Ver info'));
    expect(within(screen.getByTestId('agent-inspector-drawer')).getByTestId('related-spec-spec-alpha-1')).toBeInTheDocument();
    const dimmedInA = dimmedNodes(container);
    expect(dimmedInA).toBeGreaterThan(0);
    expect(container.querySelector('[data-participating="true"]')).not.toBeNull();

    fireEvent.change(screen.getByTestId('conversation-select'), { target: { value: 't-b' } });

    expect(screen.getByTestId('conversation-select')).toHaveValue('t-b');
    expect(screen.getByTestId('conversation-session')).toHaveTextContent('session-b-real');
    expect(screen.getByTestId('swarm-comms-console')).toHaveTextContent('diseño de beta');
    expect(screen.getByTestId('swarm-comms-console')).not.toHaveTextContent('plan de alfa');
    expect(within(screen.getByTestId('agent-inspector-drawer')).queryByTestId('related-spec-spec-alpha-1')).toBeNull();
    expect(within(screen.getByTestId('agent-inspector-drawer')).getByTestId('related-spec-spec-beta-2')).toBeInTheDocument();
  });

  it('does not dim nodes when the conversation has no events', () => {
    const { container } = renderCanvas({ threads: [{ info: info('t-empty', 'Vacía'), events: [] }] });
    expect(dimmedNodes(container)).toBe(0);
    expect(screen.getByTestId('swarm-comms-empty')).toBeInTheDocument();
  });

  it('only uses the presence of the selected conversation', () => {
    const presence: Presence[] = [
      { agent: 'sdd-planner', state: 'working', threadId: 't-a', specId: null, tool: 'Read' },
      { agent: 'sdd-architect', state: 'working', threadId: 't-b', specId: null, tool: 'Write' },
    ];
    renderCanvas({ ...twoConversations, presence });
    expect(screen.getByText('COMMS EN VIVO')).toBeInTheDocument();
    expect(screen.getAllByText('Read').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Write')).toBeNull();
  });

  it('keeps no demo controls or fabricated content', () => {
    renderCanvas(twoConversations);
    expect(screen.queryByText(/DEMO/)).toBeNull();
    expect(screen.queryByText(/TIEMPO REAL/)).toBeNull();
    expect(screen.queryByText(/Regla Cero verificada/)).toBeNull();
  });

  it('switches gate filters between cycle, transversal and all', () => {
    const onOpenDm = vi.fn();
    render(
      <I18nProvider initial="es"><BridgeContext.Provider value={mockBridgeValue}>
        <AgentMapCanvas onOpenDm={onOpenDm} onNewConversation={() => {}} />
      </BridgeContext.Provider></I18nProvider>
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
      <I18nProvider initial="es"><BridgeContext.Provider value={mockBridgeValue}>
        <AgentMapCanvas onOpenDm={onOpenDm} onNewConversation={() => {}} />
      </BridgeContext.Provider></I18nProvider>
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
      <I18nProvider initial="es"><BridgeContext.Provider value={mockBridgeValue}>
        <AgentMapCanvas onOpenDm={onOpenDm} onNewConversation={() => {}} />
      </BridgeContext.Provider></I18nProvider>
    );

    expect(screen.getByTestId('agent-inspector-drawer')).toBeInTheDocument();
    const dmButton = screen.getByText(/Abrir nuevo chat con Clara/);
    fireEvent.click(dmButton);
    expect(onOpenDm).toHaveBeenCalledWith('sdd-orchestrator');
  });

  it('provides zoom in, zoom out, and reset controls in the floating toolbar', () => {
    const onOpenDm = vi.fn();
    render(
      <I18nProvider initial="es"><BridgeContext.Provider value={mockBridgeValue}>
        <AgentMapCanvas onOpenDm={onOpenDm} onNewConversation={() => {}} />
      </BridgeContext.Provider></I18nProvider>
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
      <I18nProvider initial="es"><BridgeContext.Provider value={mockBridgeValue}>
        <AgentMapCanvas onOpenDm={onOpenDm} onNewConversation={() => {}} />
      </BridgeContext.Provider></I18nProvider>
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
