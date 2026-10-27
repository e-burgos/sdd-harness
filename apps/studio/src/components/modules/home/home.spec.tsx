import { act, fireEvent, screen, within } from '@testing-library/react';
import { useEffect, useState, type ReactNode } from 'react';
import type { ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { MODULES } from '@/lib/nav/modules';
import { useNav } from '@/lib/nav/use-nav';
import { bridgeValue, renderShell, shellSnapshot } from '../../shell/shell-test-utils';
import { HomeCenter } from './HomeCenter';
import { HomePanel } from './HomePanel';
import { HomeRight } from './HomeRight';

vi.mock('../../workspace/Composer', () => ({ Composer: ({ channelId }: { channelId: string }) => <div data-testid="composer">{channelId}</div> }));
vi.mock('../../workspace/ThreadView', () => ({ ThreadView: ({ threadId }: { threadId: string }) => <div data-testid="thread-view">{threadId}</div> }));
vi.mock('../../workspace/RunOutput', () => ({ RunOutput: () => null }));

const NOW = Date.now();
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const thread = (overrides: Partial<ThreadInfo>): ThreadInfo =>
  ({
    id: 't',
    channelId: 'general',
    title: 'Hilo',
    agent: 'sdd-orchestrator',
    options: {},
    status: 'idle',
    createdAt: iso(-1000),
    lastActivity: iso(-1000),
    link: { source: 'detected', target: { kind: 'none' } },
    pendingCount: 0,
    ...overrides,
  }) as ThreadInfo;

const snapshot: WorkspaceSnapshot = {
  ...shellSnapshot,
  specs: [
    { id: 'spec-dev-001-pagos', title: 'Pagos', status: 'in-progress', folder: 'sdd/specs/a', module: 'pagos', app: 'api', dependsOn: [] },
    { id: 'spec-dev-002-cierre', title: 'Cierre', status: 'completed', folder: 'sdd/specs/b', module: null, app: null, dependsOn: [] },
  ],
  cycles: [
    { specId: 'spec-dev-001-pagos', cycle: 'cycle-01', status: 'in-progress', flow: 'full', apps: [], tasks: [], tasksTotal: 4, tasksDone: 1 },
    { specId: 'spec-dev-002-cierre', cycle: 'cycle-02', status: 'completed', flow: 'lite', apps: [], tasks: [], tasksTotal: 2, tasksDone: 2 },
  ],
  fixes: [
    { id: 'FIX-dev-001', title: 'Arreglo menor', status: 'pending', severity: 'low', specId: null, createdAt: '2026-01-01', closedAt: null },
    { id: 'FIX-dev-002', title: 'Arreglo crítico', status: 'in-progress', severity: 'critical', specId: null, createdAt: '2026-01-02', closedAt: null },
    { id: 'FIX-dev-003', title: 'Arreglo cerrado', status: 'completed', severity: null, specId: null, createdAt: '2026-01-03', closedAt: '2026-01-04' },
  ],
  agents: [
    { id: 'sdd-planner', description: 'Planner', model: 'sonnet', source: 'sdd', path: 'p' },
    { id: 'sdd-orchestrator', description: 'Orquestador', model: 'opus', source: 'sdd', path: 'o' },
  ],
};

function fixture() {
  const value = bridgeValue({}, snapshot);
  const state = value.store.getState();
  state.setThreads([
    thread({ id: 'run', title: 'Corriendo', status: 'running', lastActivity: iso(-2000) }),
    thread({ id: 'wait', title: 'Esperando', status: 'waiting-approval', lastActivity: iso(-3000) }),
    thread({ id: 'old', title: 'Vieja', status: 'idle', lastActivity: iso(-3 * 24 * 3600 * 1000) }),
    thread({ id: 'spec1', title: 'Conversación de spec', channelId: 'spec:spec-dev-001-pagos', lastActivity: iso(-4000) }),
  ]);
  state.setPresence([{ agent: 'sdd-planner', state: 'working', threadId: 'run', specId: null, tool: 'Edit' }]);
  return value;
}

function NavProbe() {
  const home = useNav((s) => s.home);
  const module = useNav((s) => s.module);
  const filter = useNav((s) => s.filters.homeConversations);
  return <output data-testid="nav">{JSON.stringify({ home, module, filter })}</output>;
}

const navState = () => JSON.parse(screen.getByTestId('nav').textContent ?? '{}') as { home: { kind: string; channelId?: string; which?: string; threadId?: string }; module: string; filter: string };

describe('Inicio module', () => {
  beforeEach(() => window.localStorage.clear());

  it('registers the three slots without the legacy workspace', () => {
    expect(MODULES.home.Right).not.toBeNull();
    expect(MODULES.home.legacyCenter).toBeUndefined();
  });

  describe('panel', () => {
    it('shows shortcuts with counts, channels, conversations and agents', () => {
      renderShell(<HomePanel />, { value: fixture() });
      expect(screen.getByRole('button', { name: /^En curso/ })).toHaveTextContent('2');
      expect(screen.getByRole('button', { name: /^Por aprobar/ })).toHaveTextContent('1');
      for (const channel of ['general', 'specs', 'fixes']) expect(screen.getByRole('button', { name: new RegExp(`^${channel}`) })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Corriendo/ })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Abrir a .* en Agentes/ })[0]).toBeInTheDocument();
    });

    it('lists only active conversations by default and shows all on demand', () => {
      renderShell(
        <>
          <HomePanel />
          <NavProbe />
        </>,
        { value: fixture() },
      );
      expect(screen.queryByRole('button', { name: /Vieja/ })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Mostrar todas (4)' }));
      expect(navState().filter).toBe('all');
      expect(screen.getByRole('button', { name: /Vieja/ })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Solo activas' }));
      expect(navState().filter).toBe('active');
    });

    it('navigates to channels, #specs, inboxes and threads', () => {
      renderShell(
        <>
          <HomePanel />
          <NavProbe />
        </>,
        { value: fixture() },
      );
      fireEvent.click(screen.getByRole('button', { name: /^specs/ }));
      expect(navState().home).toEqual({ kind: 'specs-channel' });
      fireEvent.click(screen.getByRole('button', { name: /^fixes/ }));
      expect(navState().home).toEqual({ kind: 'channel', channelId: 'fixes' });
      fireEvent.click(screen.getByRole('button', { name: /^Por aprobar/ }));
      expect(navState().home).toEqual({ kind: 'inbox', which: 'approvals' });
      fireEvent.click(screen.getByRole('button', { name: /Corriendo/ }));
      expect(navState().home).toEqual({ kind: 'thread', threadId: 'run' });
    });

    it('opens an agent in the Agents module', () => {
      renderShell(
        <>
          <HomePanel />
          <NavProbe />
        </>,
        { value: fixture() },
      );
      fireEvent.click(screen.getAllByRole('button', { name: /Abrir a .* en Agentes/ })[0]!);
      expect(navState().module).toBe('agents');
    });

    it('filters the whole panel with the search field', () => {
      renderShell(<HomePanel />, { value: fixture() });
      fireEvent.change(screen.getByRole('textbox', { name: 'Buscar en Inicio' }), { target: { value: 'esperando' } });
      expect(screen.getByRole('button', { name: /Esperando/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Corriendo/ })).not.toBeInTheDocument();
    });

    it('shows a skeleton while there is no snapshot', () => {
      renderShell(<HomePanel />, { value: bridgeValue({}, null) });
      expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
    });
  });

  describe('center', () => {
    const renderCenter = (target: Record<string, unknown>, extra?: ReactNode) =>
      renderShell(
        <At home={target}>
          {extra}
          <HomeCenter />
        </At>,
        { value: fixture() },
      );

    it('shows the #specs summary with every spec, cycle, flow, progress and counters above the aggregated activity', () => {
      const value = fixture();
      act(() => {
        value.store.getState().receive({ kind: 'bot.event', channelId: 'spec:spec-dev-001-pagos', botKind: 'cycle.opened', payload: { cycle: 'cycle-01', specId: 'spec-dev-001-pagos', flow: 'full' }, at: iso(-500) });
        value.store.getState().receive({ kind: 'bot.event', channelId: 'spec:spec-dev-002-cierre', botKind: 'spec.status', payload: { specId: 'spec-dev-002-cierre', from: 'in-progress', to: 'completed' }, at: iso(-100) });
      });
      renderShell(
        <At home={{ kind: 'specs-channel' }}>
          <HomeCenter />
        </At>,
        { value },
      );
      const summary = screen.getByRole('region', { name: 'Resumen de specs' });
      expect(within(summary).getByRole('list', { name: 'Specs por estado' })).toHaveTextContent('en curso · 1');
      expect(within(summary).getByRole('list', { name: 'Specs por estado' })).toHaveTextContent('completado · 1');
      const pagos = within(summary).getByRole('button', { name: 'Abrir spec spec-dev-001-pagos' });
      expect(pagos).toHaveTextContent('Pagos');
      expect(pagos).toHaveTextContent('c01 · full');
      expect(within(pagos).getByTestId('mini-progress')).toHaveTextContent('1/4');
      expect(within(summary).getByRole('button', { name: 'Abrir spec spec-dev-002-cierre' })).toHaveTextContent('c02 · lite');
      const activity = screen.getByRole('region', { name: 'Actividad' });
      expect(activity).toHaveTextContent('spec-dev-002-cierre: in-progress → completed');
      expect(activity).toHaveTextContent('Se abrió cycle-01 de spec-dev-001-pagos');
      expect(summary.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getByRole('region', { name: 'Conversaciones' })).toHaveTextContent('Conversación de spec');
      expect(screen.queryByTestId('composer')).not.toBeInTheDocument();
    });

    it('shows the #fixes summary ordered by severity with state and severity counters', () => {
      const value = fixture();
      renderShell(
        <At home={{ kind: 'channel', channelId: 'fixes' }}>
          <HomeCenter />
        </At>,
        { value },
      );
      const summary = screen.getByRole('region', { name: 'Resumen de fixes' });
      const rows = within(summary).getAllByRole('button', { name: /^Abrir fix/ });
      expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual(['Abrir fix FIX-dev-002', 'Abrir fix FIX-dev-001', 'Abrir fix FIX-dev-003']);
      expect(rows[0]).toHaveTextContent('crítica');
      expect(within(summary).getByRole('list', { name: 'Fixes por severidad' })).toHaveTextContent('critical · 1');
      expect(within(summary).getByRole('list', { name: 'Fixes por estado' })).toHaveTextContent('pending · 1');
      expect(screen.getByTestId('composer')).toHaveTextContent('fixes');
    });

    it('opens a spec from the summary', () => {
      const value = fixture();
      renderShell(
        <At home={{ kind: 'specs-channel' }}>
          <NavProbe />
          <HomeCenter />
        </At>,
        { value },
      );
      fireEvent.click(screen.getByRole('button', { name: 'Abrir spec spec-dev-001-pagos' }));
      expect(navState().module).toBe('specs');
    });

    it('shows the general channel with its composer', () => {
      renderCenter({ kind: 'channel', channelId: 'general' });
      expect(screen.getByRole('heading', { name: '# general' })).toBeInTheDocument();
      expect(screen.getByTestId('composer')).toHaveTextContent('general');
    });

    it('lists running work in the inbox and opens a thread', () => {
      renderCenter({ kind: 'inbox', which: 'running' });
      expect(screen.getByRole('heading', { name: 'En curso' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Ciclos en curso' })).toHaveTextContent('spec-dev-001-pagos');
      fireEvent.click(screen.getByRole('button', { name: /Corriendo/ }));
      expect(screen.getByTestId('thread-view')).toHaveTextContent('run');
    });

    it('lists threads waiting for approval', () => {
      renderCenter({ kind: 'inbox', which: 'approvals' });
      expect(screen.getByRole('button', { name: /Esperando/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Corriendo/ })).not.toBeInTheDocument();
    });
  });

  describe('right panel', () => {
    it('shows who is working and switches to details', () => {
      renderShell(<HomeRight />, { value: fixture() });
      expect(screen.getByTestId('home-right-activity')).toHaveTextContent('Corriendo');
      fireEvent.click(screen.getByRole('tab', { name: 'Detalles' }));
      expect(screen.getByTestId('home-right-details')).toHaveTextContent('fixture-project');
    });
  });
});

function At({ home, children }: { home: Record<string, unknown>; children: ReactNode }) {
  const set = useNav((s) => s.setHome);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    set(home as never);
    setReady(true);
  }, []);
  return ready ? <>{children}</> : null;
}
