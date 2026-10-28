import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Presence, ThreadInfo, ThreadEvent } from '@sdd-studio/protocol';
import { AgentMapCanvas } from './AgentMapCanvas';
import { BridgeContext } from '../BridgeProvider';
import { SwarmPlaybackProvider } from '../modules/map/swarm-playback';
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
  { seq: 1, event: { type: 'tool.start', toolUseId: `tool-${agent}`, author: author(agent), tool: 'Write', summary: readPath } },
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

function renderCanvas(fixture: Fixture = {}, handlers: { onSelectAgent?: (id: string) => void; selectedAgent?: string | null } = {}) {
  const value = bridgeWith(fixture);
  const utils = render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <SwarmPlaybackProvider>
          <AgentMapCanvas selectedAgent={handlers.selectedAgent ?? null} onSelectAgent={handlers.onSelectAgent ?? (() => {})} />
        </SwarmPlaybackProvider>
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

  it('keeps the header on one line with the project name truncated and titled', () => {
    renderCanvas();
    const project = screen.getByText(/test-monorepo/);
    expect(project).toHaveClass('truncate');
    expect(project).toHaveAttribute('title', project.textContent ?? '');
  });

  it('no longer carries its own conversation selector, swarm console or inspector drawer', () => {
    renderCanvas(twoConversations);
    expect(screen.queryByTestId('conversation-selector')).toBeNull();
    expect(screen.queryByTestId('new-conversation-button')).toBeNull();
    expect(screen.queryByTestId('swarm-comms-console')).toBeNull();
    expect(screen.queryByTestId('agent-inspector-drawer')).toBeNull();
    expect(screen.queryByTestId('open-panel-button')).toBeNull();
  });

  it('shows no speech bubble when there are no conversations', () => {
    renderCanvas();
    expect(screen.queryByTestId('swarm-dialogue-bubble')).toBeNull();
  });

  it('dims non-participants of the followed conversation and re-dims when another is picked', () => {
    const { container, value } = renderCanvas(twoConversations);
    expect(dimmedNodes(container)).toBeGreaterThan(0);
    expect(container.querySelector('[data-participating="true"]')).not.toBeNull();
    act(() => value.store.getState().selectThread('t-b'));
    expect(container.querySelector('[data-participating="true"]')).not.toBeNull();
    expect(dimmedNodes(container)).toBeGreaterThan(0);
  });

  it('does not dim nodes when the conversation has no events', () => {
    const { container } = renderCanvas({ threads: [{ info: info('t-empty', 'Vacía'), events: [] }] });
    expect(dimmedNodes(container)).toBe(0);
    expect(screen.queryByTestId('swarm-dialogue-bubble')).toBeNull();
  });

  it('only uses the presence of the selected conversation', () => {
    const presence: Presence[] = [
      { agent: 'sdd-planner', state: 'working', threadId: 't-a', specId: null, tool: 'Read' },
      { agent: 'sdd-architect', state: 'working', threadId: 't-b', specId: null, tool: 'Write' },
    ];
    renderCanvas({ ...twoConversations, presence });
    expect(screen.getByText('1 en ejecución')).toBeInTheDocument();
    expect(screen.getByTestId('swarm-dialogue-bubble')).toBeInTheDocument();
  });

  it('keeps no demo controls or fabricated content', () => {
    renderCanvas(twoConversations);
    expect(screen.queryByText(/DEMO/)).toBeNull();
    expect(screen.queryByText(/TIEMPO REAL/)).toBeNull();
    expect(screen.queryByText(/Regla Cero verificada/)).toBeNull();
  });

  it('switches gate filters between cycle, transversal and all', () => {
    renderCanvas();

    fireEvent.click(screen.getByText('Transversales (2)'));
    expect(screen.getByTestId('gate-card-regla-cero')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-memoria-gate')).toBeInTheDocument();
    expect(screen.queryByTestId('gate-card-gate-a')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Todas (6)'));
    expect(screen.getByTestId('gate-card-regla-cero')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-gate-a')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-gate-b')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-contexto-gate')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-fix-gate')).toBeInTheDocument();
    expect(screen.getByTestId('gate-card-memoria-gate')).toBeInTheDocument();
  });

  it('opens gate inspector drawer on gate card click', () => {
    renderCanvas();
    fireEvent.click(screen.getByTestId('gate-card-gate-a'));

    expect(screen.getByTestId('gate-inspector-drawer')).toBeInTheDocument();
    expect(screen.getAllByText('SPEC GATE A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Propósito del Gate')).toBeInTheDocument();
    expect(screen.getByText('Reglas & Checklist Canónica')).toBeInTheDocument();
  });

  it('reports the agent chosen on a node through onSelectAgent', () => {
    const onSelectAgent = vi.fn();
    const { container } = renderCanvas({}, { onSelectAgent });
    const node = container.querySelector('[data-participating]') as Element;
    fireEvent.click(node);
    expect(onSelectAgent).toHaveBeenCalledTimes(1);
    expect(typeof onSelectAgent.mock.calls[0][0]).toBe('string');
  });

  it('provides zoom in, zoom out, and reset controls in the floating toolbar', () => {
    renderCanvas();

    expect(screen.getByTestId('zoom-toolbar')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(screen.getByText('115%')).toBeInTheDocument();

    const zoomOutBtn = screen.getByRole('button', { name: '-' });
    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('85%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ajustar/ }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
