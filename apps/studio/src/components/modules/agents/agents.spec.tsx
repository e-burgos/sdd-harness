import { act, fireEvent, screen } from '@testing-library/react';
import type { Presence, ThreadInfo } from '@sdd-studio/protocol';
import { bridgeValue, renderShell, shellSnapshot } from '../../shell/shell-test-utils';
import { AgentCard } from './AgentCard';
import { AgentsCenter } from './AgentsCenter';
import { AgentsPanel } from './AgentsPanel';
import { AgentsRight } from './AgentsRight';
import { agentMeta } from '@/lib/agents';
import { useNav } from '@/lib/nav/use-nav';

const snapshot = {
  ...shellSnapshot,
  agents: [
    { id: 'sdd-planner', description: 'Convierte historias en tareas', model: 'sonnet', source: 'sdd' as const, path: 'sdd/agents/sdd-planner.agent.md' },
    { id: 'sdd-reviewer', description: 'Valida el ciclo', model: 'opus', source: 'sdd' as const, path: 'sdd/agents/sdd-reviewer.agent.md' },
    { id: 'custom-bot', description: 'Agente del proyecto', model: null, source: 'claude' as const, path: '.claude/agents/custom-bot.md' },
  ],
};

const dm = (id: string, agent: string): ThreadInfo => ({
  id,
  channelId: `dm:${agent}`,
  title: `Charla ${id}`,
  agent,
  options: { agent, model: 'kit', effort: null, permissionMode: 'default' },
  status: 'idle',
  createdAt: '2026-01-01T00:00:00Z',
  lastActivity: '2026-01-02T00:00:00Z',
  link: { target: { kind: 'none' }, source: 'legacy' },
  pendingCount: 0,
});

function setup(options: { presence?: Presence[]; threads?: ThreadInfo[]; connection?: 'open' | 'closed' } = {}) {
  const value = bridgeValue({ connection: { status: options.connection ?? 'open' } as never }, snapshot);
  value.store.getState().setPresence(options.presence ?? []);
  value.store.getState().setThreads(options.threads ?? []);
  return value;
}

function Selector({ agent }: { agent: string | null }) {
  const select = useNav((s) => s.select);
  return <button onClick={() => select('agents', agent)}>pick</button>;
}

describe('Agents module', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('groups agents by origin with presence and filters by name or description', () => {
    renderShell(<AgentsPanel />, { value: setup({ presence: [{ agent: 'sdd-planner', state: 'working', threadId: null, specId: null, tool: 'Read' }] }) });
    expect(screen.getByText('Agentes del proyecto')).toBeInTheDocument();
    expect(screen.getByText('Agentes del kit')).toBeInTheDocument();
    expect(screen.getAllByTestId('presence-ring').map((el) => el.getAttribute('data-state'))).toContain('working');
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar en Agentes' }), { target: { value: 'valida' } });
    expect(screen.getByRole('button', { name: new RegExp(agentMeta('sdd-reviewer').name) })).toBeInTheDocument();
    expect(screen.queryByText('Agentes del proyecto')).toBeNull();
  });

  it('shows an explanatory empty state when the project has no agents', () => {
    renderShell(<AgentsPanel />, { value: bridgeValue({}, { ...snapshot, agents: [] }) });
    expect(screen.getByText('Este proyecto todavía no tiene agentes')).toBeInTheDocument();
  });

  it('opens the agent card in the right panel when the agent is picked', () => {
    renderShell(
      <>
        <Selector agent="sdd-planner" />
        <AgentsRight />
      </>,
      { value: setup() },
    );
    expect(screen.getByText('Elegí un agente para ver su ficha')).toBeInTheDocument();
    fireEvent.click(screen.getByText('pick'));
    const card = screen.getByTestId('agent-card');
    expect(card).toHaveAttribute('data-agent', 'sdd-planner');
    expect(card).toHaveTextContent('sonnet');
    expect(card).toHaveTextContent('Kit');
    expect(card).toHaveTextContent('sdd/agents/sdd-planner.agent.md');
    expect(card).toHaveTextContent('Convierte historias en tareas');
  });

  it('reflects presence and the current tool on the card', () => {
    renderShell(<AgentCard agentId="sdd-planner" />, { value: setup({ presence: [{ agent: 'sdd-planner', state: 'working', threadId: 't', specId: null, tool: 'Write' }] }) });
    expect(screen.getByTestId('agent-presence')).toHaveAttribute('data-state', 'working');
    expect(screen.getByTestId('agent-current-task')).toHaveTextContent('Write');
  });

  it('shows the direct chat composer on the dm channel and disables it without a connection', () => {
    const { unmount } = renderShell(<AgentCard agentId="sdd-planner" />, { value: setup() });
    expect(screen.getByTestId('agent-direct-chat')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-chat-disabled')).toBeNull();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    unmount();
    renderShell(<AgentCard agentId="sdd-planner" />, { value: setup({ connection: 'closed' }) });
    expect(screen.getByTestId('agent-chat-disabled')).toHaveTextContent('El chat directo no está disponible mientras no haya conexión con el puente.');
    expect(screen.getByTestId('agent-card')).toHaveTextContent('sdd-planner.agent.md');
  });

  it('continues the latest direct thread when one exists', () => {
    const value = setup({ threads: [dm('t-1', 'sdd-planner')] });
    renderShell(<AgentCard agentId="sdd-planner" />, { value });
    expect(screen.getByRole('heading', { level: 1, name: 'Charla t-1' })).toBeInTheDocument();
  });

  it('marks an agent missing from the snapshot as unavailable and disables chat', () => {
    renderShell(<AgentCard agentId="ghost" />, { value: setup() });
    expect(screen.getByText('Agente no disponible')).toBeInTheDocument();
    expect(screen.getByTestId('agent-chat-disabled')).toHaveTextContent('El chat directo no está disponible para este agente.');
  });

  it('lists the conversations of the chosen agent in the center and invites to pick one otherwise', () => {
    renderShell(
      <>
        <Selector agent="sdd-planner" />
        <AgentsCenter />
      </>,
      { value: setup({ threads: [dm('t-1', 'sdd-planner')] }) },
    );
    expect(screen.getByText('Elegí un agente')).toBeInTheDocument();
    act(() => fireEvent.click(screen.getByText('pick')));
    expect(screen.getByRole('button', { name: 'Abrir conversación Charla t-1' })).toBeInTheDocument();
  });
});

describe('Agent card type scale', () => {
  it('uses only scale tokens outside the hosted chat', () => {
    const { container } = renderShell(
      <div data-studio-panel="right">
        <AgentCard agentId="sdd-planner" />
      </div>,
      { value: setup() },
    );
    const forbidden = /^text-(?:xs|sm|base|lg|[2-9]?xl|body|\[.*)$/;
    const offenders = Array.from(container.querySelectorAll('*'))
      .filter((el) => !el.closest('[data-studio-exempt]'))
      .flatMap((el) => (el.getAttribute('class') ?? '').split(/\s+/).filter((token) => forbidden.test(token)));
    expect(offenders).toEqual([]);
  });
});
