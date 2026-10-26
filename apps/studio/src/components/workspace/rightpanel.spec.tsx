import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import type { ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { RightPanel, RightPanelView } from './RightPanel';

describe('RightPanelView', () => {
  it('shows activity and the cycle checklist', () => {
    const onOpenThread = vi.fn();
    render(
      <I18nProvider initial="es">
        <RightPanelView
          activity={[{ threadId: 't', title: 'pagos v2', status: 'running', agents: [{ agent: 'sdd-implementor-back', state: 'working', tool: 'Edit' }] }]}
          cycle={{ specId: 's', cycle: 'cycle-02', status: 'in-progress', flow: 'full', apps: ['apps/api'], tasksTotal: 2, tasksDone: 1, tasks: [
            { id: 'BE-001', title: 'Endpoint', status: 'done', storyPoints: 3 },
            { id: 'BE-002', title: 'Tests', status: 'in-progress', storyPoints: 2 },
          ] }}
          onOpenThread={onOpenThread}
        />
      </I18nProvider>,
    );
    expect(screen.getByText('Vulcan')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('1/2 tasks')).toBeInTheDocument();
    expect(screen.getByTestId('task-icon-done')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Panel de actividad y detalles' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '2');
    expect(screen.getByText('hecha')).toBeInTheDocument();
    expect(screen.getAllByText('trabajando')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /pagos v2/ }));
    expect(onOpenThread).toHaveBeenCalledWith('t');
  });
  it('puts the activity first with the collapse button in the header', () => {
    const onCollapse = vi.fn();
    render(<I18nProvider initial="es"><RightPanelView activity={[]} cycle={null} onOpenThread={vi.fn()} onCollapse={onCollapse} /></I18nProvider>);
    const header = screen.getByTestId('panel-header');
    expect(header).toHaveTextContent(/actividad/i);
    const toggle = screen.getByRole('button', { name: 'Colapsar panel' });
    expect(header).toContainElement(toggle);
    fireEvent.click(toggle);
    expect(onCollapse).toHaveBeenCalled();
    const aside = screen.getByRole('complementary');
    expect(aside.firstElementChild).toBe(header);
    expect(header.nextElementSibling).toBe(screen.getByTestId('panel-activity'));
  });
  it('shows empty states', () => {
    render(<I18nProvider initial="es"><RightPanelView activity={[]} cycle={null} onOpenThread={vi.fn()} /></I18nProvider>);
    expect(screen.getByText('Nadie está trabajando ahora.')).toBeInTheDocument();
    expect(screen.getByText('Este canal no tiene un ciclo activo.')).toBeInTheDocument();
  });
});

describe('RightPanel with a selected conversation', () => {
  const SPEC = 'spec-a-001-demo';
  const snapshot: WorkspaceSnapshot = {
    project: 'p', profile: 'team', kitVersion: null, gateMode: 'block', pricing: null, stale: [], skills: [], agents: [],
    specs: [{ id: SPEC, title: 'S', status: 'in-progress', folder: 'f', module: null, app: null, dependsOn: [] }],
    cycles: [{ specId: SPEC, cycle: 'cycle-02', status: 'in-progress', flow: 'full', apps: [], tasks: [{ id: 'T-1', title: 'Hacer', status: 'pending', storyPoints: null }], tasksTotal: 1, tasksDone: 0 }],
    fixes: [{ id: 'FIX-a-001', title: 'x', status: 'pending', severity: null, specId: SPEC, createdAt: null, closedAt: null }],
  };
  const info: ThreadInfo = {
    id: 't1', channelId: 'general', title: 'hilo', agent: 'sdd-orchestrator',
    options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' },
    status: 'idle', createdAt: '1', lastActivity: '1', link: { target: { kind: 'none' }, source: 'auto' }, pendingCount: 0,
  };
  const write = (seq: number, summary: string) => ({ seq, event: { type: 'tool.start', toolUseId: `w${seq}`, author: { agent: 'sdd-planner', parentToolUseId: null }, tool: 'Write', summary } as never });

  function mount(threadId: string | null, events: { seq: number; event: never }[]) {
    const store = createStudioStore();
    store.getState().setSnapshot(snapshot);
    store.getState().setThreads([info]);
    store.getState().loadHistory('t1', events);
    const value = { client: { request: vi.fn() }, store, connection: { status: 'idle' } } as unknown as BridgeContextValue;
    render(
      <I18nProvider initial="es">
        <BridgeContext.Provider value={value}>
          <RightPanel channelId="general" threadId={threadId} onOpenThread={vi.fn()} />
        </BridgeContext.Provider>
      </I18nProvider>,
    );
  }

  it('derives where you are, documents, recent actions and the cycle from the conversation without a manual link', () => {
    mount('t1', [write(0, `sdd/specs/${SPEC}/cycles/cycle-02/plan.md`), write(1, `sdd/specs/${SPEC}/fixes/fix-a-001.md`)]);
    expect(screen.getByTestId('panel-gate')).toHaveTextContent('FIX GATE FIX-a-001');
    expect(screen.getByTestId('related-spec-' + SPEC)).toBeInTheDocument();
    expect(screen.getByTestId('related-fix-FIX-a-001')).toBeInTheDocument();
    expect(screen.getByTestId('panel-recent')).toHaveTextContent('fix-a-001.md');
  });

  it('orders sections as activity, where, documents, recent, details', () => {
    mount('t1', [write(0, `sdd/specs/${SPEC}/cycles/cycle-02/plan.md`)]);
    const order = ['panel-activity', 'panel-where', 'panel-documents', 'panel-recent'].map((id) => screen.getByTestId(id));
    order.forEach((el, i) => {
      if (i > 0) expect(order[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    const details = screen.getByText('Detalles');
    expect(order[3].compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('prefers the derived cycle in Detalles over the channel fallback', () => {
    mount('t1', [write(0, `sdd/specs/${SPEC}/cycles/cycle-02/plan.md`)]);
    expect(screen.getByTestId('panel-gate')).toHaveTextContent(`SPEC GATE ${SPEC} cycle-02`);
    expect(screen.getByText('T-1')).toBeInTheDocument();
    expect(screen.queryByText('Este canal no tiene un ciclo activo.')).toBeNull();
  });

  it('keeps the current empty states for an empty thread or no selected thread', () => {
    mount('t1', []);
    expect(screen.getByTestId('panel-gate')).toHaveTextContent('Sin gate activo en esta conversación');
    expect(screen.getByTestId('related-documents-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-recent')).toBeNull();
    expect(screen.getByText('Nadie está trabajando ahora.')).toBeInTheDocument();
    expect(screen.getByText('Este canal no tiene un ciclo activo.')).toBeInTheDocument();
  });

  it('does not render conversation sections without a selected thread', () => {
    mount(null, []);
    expect(screen.queryByTestId('panel-where')).toBeNull();
    expect(screen.getByText('Nadie está trabajando ahora.')).toBeInTheDocument();
  });
});

