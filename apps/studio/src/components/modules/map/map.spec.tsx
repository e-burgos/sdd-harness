import { act, fireEvent, screen, within } from '@testing-library/react';
import type { ThreadInfo } from '@sdd-studio/protocol';
import { bridgeValue, renderShell, shellSnapshot } from '../../shell/shell-test-utils';
import { MapPanel } from './MapPanel';
import { MapRight } from './MapRight';
import { SwarmPlaybackProvider } from './swarm-playback';
import { mapModule } from './index';
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

  it('shows only the swarm interaction and a hint until an agent is selected, then adds the card', () => {
    renderShell(
      <Wrapped>
        <Pick agent="sdd-planner" />
        <MapRight />
      </Wrapped>,
      { value: setup() },
    );
    expect(screen.getByTestId('swarm-interaction')).toBeInTheDocument();
    expect(screen.getByTestId('map-select-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-card')).toBeNull();
    act(() => fireEvent.click(screen.getByText('pick')));
    expect(screen.getByTestId('agent-card')).toHaveAttribute('data-agent', 'sdd-planner');
    expect(screen.queryByTestId('map-select-hint')).toBeNull();
  });
});
