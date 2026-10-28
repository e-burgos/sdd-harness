import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { BotEvent, ThreadInfo } from '@sdd-studio/protocol';
import { useNav } from '@/lib/nav/use-nav';
import { emptyThread } from '@/lib/store/timeline';
import { bridgeValue, renderShell } from '../../shell/shell-test-utils';
import { activityModule } from './index';

const { Panel, Center, Right, Scope } = activityModule;
const ActivityScope = Scope!;

const now = new Date().setHours(12, 0, 0, 0);
const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();
const HOUR = 3_600_000;

const bot = (botKind: BotEvent['botKind'], channelId: string, payload: Record<string, unknown>, at?: string): BotEvent => ({ botKind, channelId, payload, ...(at ? { at } : {}) });

const info: ThreadInfo = {
  id: 'th-1',
  channelId: 'general',
  title: 'Revisión de pagos',
  agent: 'sdd-planner',
  options: { agent: 'sdd-planner', model: 'kit', effort: null, permissionMode: 'default' },
  status: 'idle',
  createdAt: iso(48 * HOUR),
  lastActivity: iso(HOUR),
  link: { target: { kind: 'none' }, source: 'legacy' },
  pendingCount: 0,
};

const HISTORY: Record<string, BotEvent[]> = {
  general: [bot('tools.changed', 'general', { tool: 'rtk', from: false, to: true }, iso(2 * HOUR))],
  fixes: [bot('fix.created', 'fixes', { fixId: 'FIX-dev-001' }, iso(3 * HOUR))],
  'spec:spec-dev-001-pagos': [
    bot('task.status', 'spec:spec-dev-001-pagos', { specId: 'spec-dev-001-pagos', cycle: 'cycle-01', taskId: 'TASK-001', title: 'Migración', from: 'in-progress', to: 'done' }, iso(4 * HOUR)),
    bot('cycle.opened', 'spec:spec-dev-001-pagos', { specId: 'spec-dev-001-pagos', cycle: 'cycle-02', flow: 'full', status: 'in-progress' }, iso(30 * HOUR)),
  ],
};

function Probe() {
  const module = useNav((s) => s.module);
  const specs = useNav((s) => s.selection.specs);
  const fixes = useNav((s) => s.selection.fixes);
  const kit = useNav((s) => s.selection.kit);
  const home = useNav((s) => s.home);
  return <output data-testid="nav">{`${module}|${specs ?? ''}|${fixes ?? ''}|${home.kind === 'thread' ? home.threadId : ''}|${kit ?? ''}`}</output>;
}

function setup(options: { history?: Record<string, BotEvent[]>; withThread?: boolean; features?: string[]; request?: (command: { channelId: string }) => unknown } = {}) {
  const history = options.history ?? HISTORY;
  const value = bridgeValue({
    client: { request: async (command: { channelId: string }) => (options.request ? options.request(command) : (history[command.channelId] ?? [])), supports: (feature: string) => (options.features ?? ['kit-tools']).includes(feature) } as never,
  });
  if (options.withThread !== false) {
    value.store.setState({
      threads: {
        'th-1': {
          ...emptyThread(),
          info,
          items: [
            { kind: 'approval', id: 'ap-1', seq: 2, author: { kind: 'main' } as never, tool: 'Bash', summary: '$ pnpm test', decision: 'pending' },
            { kind: 'question', id: 'q-1', seq: 4, author: { kind: 'main' } as never, questions: [{ question: '¿Aplicamos el cambio?', options: [], multiSelect: false }], outcome: 'answered' },
          ],
        },
      },
    });
  }
  return { value, ...renderShell(<ActivityScope><Panel /><Center /><Probe /></ActivityScope>, { value }) };
}

const pill = (name: RegExp) => screen.getByRole('button', { name });

describe('Activity module', () => {
  beforeEach(() => window.localStorage.clear());

  it('has no right panel', () => {
    expect(Right).toBeNull();
  });

  it('merges thread and bot events across channels, newest first, grouped by day', async () => {
    setup();
    await screen.findByText('rtk: Desactivado → Activado (sdd/tools.json)');
    const labels = within(screen.getByRole('region', { name: 'Actividad del proyecto' })).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(labels[0]).toBe('Hoy');
    expect(labels).toHaveLength(2);
    const lines = screen.getAllByRole('listitem').map((item) => item.textContent ?? '');
    const order = ['Bash: $ pnpm test', '¿Aplicamos el cambio?', 'rtk: Desactivado → Activado (sdd/tools.json)', 'FIX-dev-001', 'TASK-001', 'cycle-02'].map((needle) => lines.findIndex((line) => line.includes(needle)));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order[2]).toBeLessThan(order[3]!);
    expect(order[3]).toBeLessThan(order[4]!);
    expect(order[4]).toBeLessThan(order[5]!);
    expect(lines.findIndex((line) => line.includes('cycle-02'))).toBe(lines.length - 1);
  });

  it('does not ask for kit events and still renders the timeline when the bridge lacks kit-tools', async () => {
    const requests: Record<string, unknown>[] = [];
    setup({
      features: [],
      request: (command) => {
        requests.push(command);
        return HISTORY[command.channelId] ?? [];
      },
    });
    await screen.findByText(/FIX-dev-001/);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.some((request) => 'includeKitEvents' in request)).toBe(false);
    expect(screen.getByText('Bash: $ pnpm test')).toBeInTheDocument();
  });

  it('shows a count per origin on each pill', async () => {
    setup();
    await screen.findByText('rtk: Desactivado → Activado (sdd/tools.json)');
    expect(pill(/Aprobaciones/)).toHaveTextContent('1');
    expect(pill(/Preguntas de agentes/)).toHaveTextContent('1');
    expect(pill(/Tareas terminadas/)).toHaveTextContent('1');
    expect(pill(/Eventos de specs/)).toHaveTextContent('1');
    expect(pill(/Eventos de fixes/)).toHaveTextContent('1');
    expect(pill(/Cambios de herramientas/)).toHaveTextContent('1');
  });

  it('limits the timeline to the chosen origins and restores it with Todo', async () => {
    setup();
    await screen.findByText('rtk: Desactivado → Activado (sdd/tools.json)');
    fireEvent.click(pill(/Cambios de herramientas/));
    expect(screen.getByText('rtk: Desactivado → Activado (sdd/tools.json)')).toBeInTheDocument();
    expect(screen.queryByText(/FIX-dev-001/)).not.toBeInTheDocument();
    fireEvent.click(pill(/Eventos de fixes/));
    expect(screen.getByText(/FIX-dev-001/)).toBeInTheDocument();
    expect(screen.getByText('rtk: Desactivado → Activado (sdd/tools.json)')).toBeInTheDocument();
    fireEvent.click(pill(/^Todo/));
    expect(screen.getByText('¿Aplicamos el cambio?')).toBeInTheDocument();
  });

  it('keeps the chosen origins in the nav store and restores them after remounting', async () => {
    window.localStorage.clear();
    const first = setup();
    await screen.findByText('rtk: Desactivado → Activado (sdd/tools.json)');
    fireEvent.click(pill(/Cambios de herramientas/));
    await waitFor(() => expect(window.localStorage.getItem('sdd-studio.nav.v1:fixture-project')).toContain('"activity":["tools"]'));
    first.unmount();
    setup();
    await screen.findByText('rtk: Desactivado → Activado (sdd/tools.json)');
    expect(screen.queryByText(/FIX-dev-001/)).not.toBeInTheDocument();
    window.localStorage.clear();
  });

  it('shows an empty state per filter when nothing matches and clears it', async () => {
    setup({ history: { ...HISTORY, fixes: [] } });
    await screen.findByText('rtk: Desactivado → Activado (sdd/tools.json)');
    fireEvent.click(pill(/Eventos de fixes/));
    expect(screen.getByText('Ningún evento coincide')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtro' }));
    expect(screen.queryByText('Ningún evento coincide')).not.toBeInTheDocument();
    expect(screen.getByText('rtk: Desactivado → Activado (sdd/tools.json)')).toBeInTheDocument();
  });

  it('shows an explanatory empty state when the project has no activity', async () => {
    setup({ history: {}, withThread: false });
    expect(await screen.findByText('Todavía no hay actividad')).toBeInTheDocument();
  });

  it('searches by event text and by origin', async () => {
    setup();
    await screen.findByText('rtk: Desactivado → Activado (sdd/tools.json)');
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar en Actividad' }), { target: { value: 'migración' } });
    expect(screen.getByText(/TASK-001/)).toBeInTheDocument();
    expect(screen.queryByText('rtk: Desactivado → Activado (sdd/tools.json)')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar en Actividad' }), { target: { value: 'pregunta' } });
    expect(screen.getByText('¿Aplicamos el cambio?')).toBeInTheDocument();
    expect(screen.queryByText(/TASK-001/)).not.toBeInTheDocument();
  });

  it('opens the conversation, spec, fix or kit of each entry', async () => {
    setup();
    await screen.findByText('rtk: Desactivado → Activado (sdd/tools.json)');
    fireEvent.click(screen.getByText('¿Aplicamos el cambio?').closest('button') as HTMLElement);
    expect(screen.getByTestId('nav')).toHaveTextContent('home|||th-1');
    fireEvent.click(screen.getByText(/FIX-dev-001/).closest('button') as HTMLElement);
    expect(screen.getByTestId('nav')).toHaveTextContent('fixes||FIX-dev-001|th-1');
    fireEvent.click(screen.getByText(/TASK-001/).closest('button') as HTMLElement);
    expect(screen.getByTestId('nav')).toHaveTextContent('specs|spec-dev-001-pagos|FIX-dev-001|th-1');
    fireEvent.click(screen.getByText('rtk: Desactivado → Activado (sdd/tools.json)').closest('button') as HTMLElement);
    expect(screen.getByTestId('nav')).toHaveTextContent(/^kit\|.*\|tools$/);
  });

  it('describes a SPEC GATE change with the localized mode on both ends', async () => {
    setup({ history: { general: [bot('tools.changed', 'general', { tool: 'gate', from: 'block', to: 'warn' }, iso(HOUR))] }, withThread: false });
    expect(await screen.findByText('SPEC GATE: Bloquear → Avisar (sdd/tools.json)')).toBeInTheDocument();
  });

  it('labels thread-derived times as approximate', async () => {
    setup();
    await screen.findByText('rtk: Desactivado → Activado (sdd/tools.json)');
    const row = screen.getByText('¿Aplicamos el cambio?').closest('button') as HTMLElement;
    expect(row.querySelector('[title]')?.textContent).toMatch(/^~/);
  });

  it('reports a load failure with a retry that recovers', async () => {
    let failing = true;
    setup({
      request: (command) => {
        if (failing && command.channelId === 'fixes') throw new Error('boom');
        return HISTORY[command.channelId] ?? [];
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar parte de la actividad.');
    failing = false;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    });
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByText(/FIX-dev-001/)).toBeInTheDocument();
  });
});
