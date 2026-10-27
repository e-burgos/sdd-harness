import { act, fireEvent, screen, within } from '@testing-library/react';
import type { ThreadInfo } from '@sdd-studio/protocol';
import { bridgeValue, renderShell, shellSnapshot } from '../../shell/shell-test-utils';
import { MapPanel } from './MapPanel';
import { MapAgentChat } from './MapAgentChat';
import { MapRight } from './MapRight';
import { useMapChatState } from './map-chat-state';
import { SwarmPlaybackProvider } from './swarm-playback';
import { mapModule } from './index';
import { agentMeta } from '@/lib/agents';
import { useNav } from '@/lib/nav/use-nav';

const snapshot = {
  ...shellSnapshot,
  agents: [{ id: 'sdd-planner', description: 'Planner', model: 'sonnet', source: 'sdd' as const, path: 'sdd/agents/sdd-planner.agent.md' }],
};

const thread = (id: string, patch: Partial<ThreadInfo>): ThreadInfo => ({
  id,
  channelId: 'general',
  title: id,
  agent: 'sdd-planner',
  options: { agent: 'sdd-planner', model: 'kit', effort: null, permissionMode: 'default' },
  status: 'idle',
  createdAt: '2026-01-01T00:00:00Z',
  lastActivity: '2026-01-02T00:00:00Z',
  link: { target: { kind: 'none' }, source: 'legacy' },
  pendingCount: 0,
  ...patch,
});

const THREADS = [
  thread('libre', {}),
  thread('en-ciclo', { status: 'running', link: { target: { kind: 'cycle', specId: 'spec-dev-001-pagos', cycle: 'cycle-01' }, source: 'manual' } }),
  thread('de-fix', { link: { target: { kind: 'fix', fixId: 'FIX-dev-001' }, source: 'manual' } }),
];

function setup() {
  const value = bridgeValue({}, snapshot);
  value.store.getState().setThreads(THREADS);
  return value;
}

function Pick({ agent }: { agent: string }) {
  const select = useNav((s) => s.select);
  return <button onClick={() => select('agents', agent)}>pick</button>;
}

const Wrapped = ({ children }: { children: React.ReactNode }) => <SwarmPlaybackProvider>{children}</SwarmPlaybackProvider>;

describe('Map module', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    useMapChatState.getState().closeChat();
  });

  it('registers a swarm scope and lets the shell render the three columns', () => {
    expect(mapModule.Scope).toBe(SwarmPlaybackProvider);
    expect(mapModule.legacyCenter).toBeUndefined();
    expect(mapModule.Right).not.toBeNull();
  });

  it('shows the new conversation action, the five filters with counts and the conversation list', () => {
    renderShell(<Wrapped><MapPanel /></Wrapped>, { value: setup() });
    expect(screen.getByRole('button', { name: 'Nueva conversación' })).toBeInTheDocument();
    const filters = screen.getByRole('group', { name: 'Filtros de conversaciones' });
    for (const [label, count] of [['Todas', '3'], ['Transversal', '1'], ['Por ciclo', '1'], ['En ejecución', '1'], ['Listas', '2']]) {
      const pill = within(filters).getByRole('button', { name: new RegExp(label) });
      expect(pill).toHaveTextContent(count);
    }
    expect(screen.getAllByRole('button', { name: /libre|en-ciclo|de-fix/ })).toHaveLength(3);
  });

  it('narrows the list with a filter and groups it by cycle', () => {
    renderShell(<Wrapped><MapPanel /></Wrapped>, { value: setup() });
    fireEvent.click(within(screen.getByRole('group', { name: 'Filtros de conversaciones' })).getByRole('button', { name: /Por ciclo/ }));
    expect(screen.getByText('spec-dev-001-pagos/cycle-01')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /libre/ })).toBeNull();
    fireEvent.click(within(screen.getByRole('group', { name: 'Filtros de conversaciones' })).getByRole('button', { name: /Transversal/ }));
    expect(screen.getByRole('button', { name: /libre/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /en-ciclo/ })).toBeNull();
  });

  it('searches by title and by associated spec, cycle or fix', () => {
    renderShell(<Wrapped><MapPanel /></Wrapped>, { value: setup() });
    const search = screen.getByRole('textbox', { name: 'Buscar en Mapa' });
    fireEvent.change(search, { target: { value: 'FIX-dev-001' } });
    expect(screen.getByRole('button', { name: /de-fix/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /libre/ })).toBeNull();
  });

  it('selects the conversation in the store when picked', () => {
    const value = setup();
    renderShell(<Wrapped><MapPanel /></Wrapped>, { value });
    fireEvent.click(screen.getByRole('button', { name: /de-fix/ }));
    expect(value.store.getState().selectedThreadId).toBe('de-fix');
  });

  it('embeds the inspector in the right panel: swarm comms until an agent is selected, then its profile and feed', () => {
    renderShell(
      <Wrapped>
        <Pick agent="sdd-planner" />
        <MapRight />
      </Wrapped>,
      { value: setup() },
    );
    const drawer = screen.getByTestId('agent-inspector-drawer');
    expect(drawer).toHaveAttribute('data-embedded', 'true');
    expect(drawer.className).not.toContain('absolute');
    expect(screen.getByTestId('swarm-comms-empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('live-agent-chat-feed')).toBeNull();
    act(() => fireEvent.click(screen.getByText('pick')));
    expect(screen.getByTestId('live-agent-chat-feed')).toBeInTheDocument();
    expect(within(screen.getByTestId('agent-inspector-drawer')).getByRole('heading', { name: agentMeta('sdd-planner').name })).toBeInTheDocument();
  });

  it('switches between the swarm comms and the selected agent with tabs and has no close button', () => {
    renderShell(
      <Wrapped>
        <Pick agent="sdd-planner" />
        <MapRight />
      </Wrapped>,
      { value: setup() },
    );
    const tablist = screen.getByRole('tablist', { name: 'Vista del panel' });
    expect(within(tablist).getByRole('tab', { name: 'Enjambre' })).toHaveAttribute('aria-selected', 'true');
    expect(within(tablist).getAllByRole('tab').find((tab) => tab.textContent !== 'Enjambre')).toBeDisabled();
    act(() => fireEvent.click(screen.getByText('pick')));
    const agentTab = within(tablist).getByRole('tab', { name: agentMeta('sdd-planner').name });
    expect(agentTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(within(tablist).getByRole('tab', { name: 'Enjambre' }));
    expect(screen.getByTestId('swarm-comms-empty-state')).toBeInTheDocument();
    fireEvent.click(within(tablist).getByRole('tab', { name: agentMeta('sdd-planner').name }));
    expect(screen.getByTestId('live-agent-chat-feed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Contraer panel' })).toBeNull();
  });

  it('keeps the direct chat out of the right panel and expands the floating card from the open chat button', () => {
    renderShell(
      <Wrapped>
        <Pick agent="sdd-planner" />
        <MapRight />
        <MapAgentChat />
      </Wrapped>,
      { value: setup() },
    );
    act(() => fireEvent.click(screen.getByText('pick')));
    const drawer = screen.getByTestId('agent-inspector-drawer');
    expect(within(drawer).queryByTestId('agent-direct-chat')).toBeNull();
    expect(screen.queryByTestId('map-agent-chat')).toBeNull();
    fireEvent.click(within(drawer).getByText(/Abrir nuevo chat con/));
    expect(screen.getByTestId('map-agent-chat')).toHaveAttribute('data-expanded', 'true');
    expect(screen.getByTestId('map-agent-chat')).toHaveAttribute('data-agent', 'sdd-planner');
  });

  it('gives a map agent that is not in the snapshot its card and an enabled direct chat', () => {
    renderShell(
      <Wrapped>
        <Pick agent="sdd-hermes" />
        <MapRight />
        <MapAgentChat />
      </Wrapped>,
      { value: setup() },
    );
    act(() => fireEvent.click(screen.getByText('pick')));
    expect(within(screen.getByTestId('agent-inspector-drawer')).getByRole('heading', { name: agentMeta('sdd-hermes').name })).toBeInTheDocument();
    expect(screen.queryByText('Agente no disponible')).toBeNull();
    act(() => useMapChatState.getState().openChat());
    const chat = screen.getByTestId('map-agent-chat');
    expect(within(chat).queryByTestId('agent-chat-disabled')).toBeNull();
    expect(within(chat).getByRole('textbox')).toBeInTheDocument();
  });

  it('keeps the unavailable state for an agent that is neither on the map nor in the snapshot', () => {
    renderShell(
      <Wrapped>
        <Pick agent="ghost" />
        <MapRight />
        <MapAgentChat />
      </Wrapped>,
      { value: setup() },
    );
    act(() => fireEvent.click(screen.getByText('pick')));
    act(() => useMapChatState.getState().openChat());
    expect(within(screen.getByTestId('map-agent-chat')).getByTestId('agent-chat-disabled')).toBeInTheDocument();
  });

  it('floats the direct chat only after it is opened for the selected agent and closes it from its button', () => {
    renderShell(
      <Wrapped>
        <Pick agent="sdd-planner" />
        <MapAgentChat />
      </Wrapped>,
      { value: setup() },
    );
    act(() => fireEvent.click(screen.getByText('pick')));
    expect(screen.queryByTestId('map-agent-chat')).toBeNull();
    act(() => useMapChatState.getState().openChat());
    const chat = screen.getByTestId('map-agent-chat');
    expect(chat).toHaveAttribute('data-agent', 'sdd-planner');
    expect(chat).toHaveTextContent(agentMeta('sdd-planner').name);
    expect(chat.className).toContain('max-w-[560px]');
    expect(chat.parentElement?.className).toContain('absolute');
    fireEvent.click(within(chat).getByRole('button', { name: 'Cerrar chat' }));
    expect(screen.queryByTestId('map-agent-chat')).toBeNull();
  });
});
