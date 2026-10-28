import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { WorkspaceSnapshot } from '@sdd-studio/protocol';
import { BridgeError } from '@/lib/bridge/client';
import { MODULES } from '@/lib/nav/modules';
import { bridgeValue, renderShell, shellSnapshot } from '../../shell/shell-test-utils';
import { metricsModule } from './index';

vi.mock('../../mission-control/EcosystemDashboard', () => ({ EcosystemDashboard: () => <div data-testid="ecosystem-view" /> }));
vi.mock('../../mission-control/LiveTelemetryHUD', () => ({ LiveTelemetryHUD: () => <div data-testid="telemetry-view" /> }));

const { Panel, Center } = metricsModule;

const PRICING = { currency: 'USD', model_prices_per_mtok: { 'claude/sonnet': { input: 3, output: 15 }, 'claude/opus': { input: 5, output: 25 } } };

const snapshot: WorkspaceSnapshot = {
  ...shellSnapshot,
  cycles: [{ specId: 'spec-dev-001-pagos', cycle: 'cycle-01', status: 'in-progress', flow: 'full', apps: ['api'], tasks: [{ id: 'TASK-001', title: 'Modelo', status: 'done', storyPoints: 3 }, { id: 'TASK-002', title: 'Vista', status: 'pending', storyPoints: 2 }], tasksTotal: 2, tasksDone: 1 }],
  pricing: PRICING,
};

const files: Record<string, unknown> = {
  'sdd/specs/spec-dev-001-pagos/cycles/cycle-01/cycle.json': { metrics: { usage: { by_agent: [{ agent: 'sdd-planner', provider_model: 'claude/opus', tokens_in: 1_000_000, tokens_out: 0 }] } } },
  'sdd/fixes.json': { fixes: [] },
};

function client(over: { supports?: (f: string) => boolean; rtk?: unknown; failReads?: { current: boolean } } = {}) {
  return {
    supports: over.supports ?? (() => false),
    request: async (cmd: { cmd: string; path?: string }) => {
      if (cmd.cmd === 'kit.rtkGain') return over.rtk;
      if (cmd.cmd === 'workspace.readFile' && over.failReads?.current) throw new BridgeError('disconnected', 'bridge down');
      if (cmd.cmd === 'workspace.readFile' && cmd.path && cmd.path in files) return { content: JSON.stringify(files[cmd.path]) };
      throw new BridgeError('not-found', 'missing');
    },
  };
}

const setView = (view: string | null) =>
  window.localStorage.setItem(
    'sdd-studio.nav.v1:fixture-project',
    JSON.stringify({ module: 'metrics', selection: { specs: null, fixes: null, agents: null, kit: null, architecture: null, metrics: view }, specTab: 'summary', specCycle: null, home: { kind: 'channel', channelId: 'general' }, filters: { homeConversations: 'active', specs: 'active', map: 'all', activity: ['spec', 'fix', 'agent', 'tools'] } }),
  );

const renderMetrics = (view: string | null, over: Parameters<typeof client>[0] = {}, snap: WorkspaceSnapshot | null = snapshot) => {
  setView(view);
  return renderShell(
    <>
      <Panel />
      <Center />
    </>,
    { value: bridgeValue({ client: client(over) } as never, snap) },
  );
};

describe('Metrics module', () => {
  beforeEach(() => window.localStorage.clear());

  it('is registered without a right panel', () => {
    expect(MODULES.metrics.Right).toBeNull();
  });

  it('lists the five views in the panel and marks the selected one', () => {
    renderMetrics('costs');
    const panel = document.querySelector('[data-studio-panel]') as HTMLElement;
    expect(within(panel).getAllByRole('button').filter((b) => b.hasAttribute('title')).map((b) => b.getAttribute('title'))).toEqual(['Dashboard', 'Planificación', 'Costos', 'Ecosistema', 'Telemetría']);
    expect(within(panel).getByRole('button', { name: 'Costos' })).toHaveAttribute('aria-current', 'true');
  });

  it('shows the dashboard by default and switches the center when a view is chosen', () => {
    renderMetrics(null);
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Telemetría' }));
    expect(screen.getByTestId('telemetry-view')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ecosistema' }));
    expect(screen.getByTestId('ecosystem-view')).toBeInTheDocument();
  });

  it('dashboard shows the snapshot figures', () => {
    renderMetrics('dashboard');
    expect(screen.getByText('Avance de tareas')).toBeInTheDocument();
    expect(screen.getByText('1 de 2 hechas')).toBeInTheDocument();
    expect(screen.getByText('Fixes abiertos')).toBeInTheDocument();
  });

  it('planning lists the spec with its cycle and tasks and toggles it', () => {
    renderMetrics('planning');
    expect(screen.getByText('Pagos')).toBeInTheDocument();
    expect(screen.getByText('Vista')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar u ocultar ciclos de spec-dev-001-pagos' }));
    expect(screen.queryByText('Vista')).not.toBeInTheDocument();
  });

  it('costs shows the estimated cost from cycle usage and the pricing', async () => {
    renderMetrics('costs');
    await waitFor(() => expect(screen.getByText('Por agente')).toBeInTheDocument());
    expect(screen.getAllByText(/5,00/).length).toBeGreaterThan(0);
    expect(screen.getByText('Por ciclo y fix')).toBeInTheDocument();
  });

  it('costs shows an error with retry when reads fail and recovers on retry', async () => {
    const failReads = { current: true };
    renderMetrics('costs', { failReads });
    expect(await screen.findByText('No se pudo leer el consumo registrado')).toBeInTheDocument();
    expect(screen.queryByText('Todavía no hay telemetría registrada')).not.toBeInTheDocument();
    failReads.current = false;
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByText('Por agente')).toBeInTheDocument());
  });

  it('costs explains the missing pricing instead of showing zero', async () => {
    renderMetrics('costs', {}, { ...snapshot, pricing: null });
    expect(await screen.findByText('Sin tarifas para calcular costos')).toBeInTheDocument();
    expect(screen.queryByText(/0,00/)).not.toBeInTheDocument();
  });

  it('costs explains when no telemetry has been recorded', async () => {
    const empty = { ...snapshot, cycles: [] };
    renderMetrics('costs', {}, empty);
    expect(await screen.findByText('Todavía no hay telemetría registrada')).toBeInTheDocument();
  });

  it('rtk tab degrades when the bridge lacks the feature', async () => {
    renderMetrics('costs');
    fireEvent.click(screen.getByRole('tab', { name: 'Ahorro de rtk' }));
    expect(await screen.findByText('Este puente no ofrece el ahorro de rtk')).toBeInTheDocument();
  });

  it('rtk tab reports a missing binary', async () => {
    renderMetrics('costs', { supports: (f) => f === 'rtk-gain', rtk: { status: 'not-installed', version: null, gain: null, readAt: '2026-10-27T00:00:00.000Z' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Ahorro de rtk' }));
    expect(await screen.findByText('rtk no está instalado en esta máquina')).toBeInTheDocument();
  });

  it('rtk tab shows the savings from kit.rtkGain', async () => {
    const gain = { summary: { total_commands: 12, total_input: 5000, total_output: 1000, total_saved: 4000, avg_savings_pct: 80 }, by_command: [{ command: 'pnpm test', commands: 5, saved_tokens: 3000 }] };
    renderMetrics('costs', { supports: (f) => f === 'rtk-gain', rtk: { status: 'ok', version: '0.9.1', gain, readAt: '2026-10-27T00:00:00.000Z' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Ahorro de rtk' }));
    expect(await screen.findByText('Tokens ahorrados')).toBeInTheDocument();
    expect(screen.getByText('80% promedio')).toBeInTheDocument();
    expect(screen.getByText('pnpm test')).toBeInTheDocument();
  });

  it('rtk tab shows an error with retry when the command fails', async () => {
    renderMetrics('costs', { supports: (f) => f === 'rtk-gain', rtk: { nope: true } });
    fireEvent.click(screen.getByRole('tab', { name: 'Ahorro de rtk' }));
    expect(await screen.findByText('No se pudo leer el ahorro de rtk')).toBeInTheDocument();
  });
});
