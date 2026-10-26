import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { deriveConversation } from '@/lib/conversation';
import { deriveConversationGate, type ConversationGate } from '@/lib/conversation-gate';
import { I18nProvider } from '@/lib/i18n/i18n';
import { emptyThread, type TimelineItem } from '@/lib/store/timeline';
import { GateStatusModal } from './GateStatusModal';

const SPEC = 'spec-e-burgos-005-sessions';

const thread: ThreadInfo = {
  id: 't',
  channelId: 'general',
  title: 'Seguimos con el plan',
  agent: 'sdd-orchestrator',
  options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' },
  status: 'running',
  createdAt: '2026-01-01T00:00:00Z',
  lastActivity: '2026-01-01T00:00:00Z',
  link: { target: { kind: 'none' }, source: 'legacy' },
  pendingCount: 0,
  engineSessionId: 'session-abc',
  provider: 'claude',
};

const snapshot: WorkspaceSnapshot = {
  project: 'p',
  profile: 'team',
  kitVersion: null,
  gateMode: 'block',
  pricing: null,
  stale: [],
  agents: [],
  skills: [],
  specs: [{ id: SPEC, title: 'S', status: 'in-progress', folder: 'f', module: null, app: null, dependsOn: [] }],
  cycles: [
    {
      specId: SPEC,
      cycle: 'cycle-01',
      status: 'in-progress',
      flow: 'full',
      apps: [],
      tasks: [
        { id: 'TASK-001', title: 'Primera', status: 'done', storyPoints: null },
        { id: 'TASK-002', title: 'Segunda', status: 'pending', storyPoints: null },
      ],
      tasksTotal: 2,
      tasksDone: 1,
    },
  ],
  fixes: [{ id: 'FIX-e-burgos-005-006', title: 'F', status: 'pending', severity: null, specId: SPEC, createdAt: null, closedAt: null }],
};

const items: TimelineItem[] = [
  { kind: 'user', id: 'u1', seq: 1, text: 'arrancá' },
  { kind: 'tool', id: 't2', seq: 2, author: { agent: 'sdd-reviewer', parentToolUseId: null }, tool: 'Write', summary: `sdd/specs/${SPEC}/cycles/cycle-01/plan.md`, status: 'ok' },
  { kind: 'tool', id: 't3', seq: 3, author: { agent: 'sdd-reviewer', parentToolUseId: null }, tool: 'Write', summary: `sdd/specs/${SPEC}/fixes/fix-e-burgos-005-006.md`, status: 'ok' },
  { kind: 'message', id: 'm4', seq: 4, author: { agent: 'sdd-planner', parentToolUseId: null }, text: 'Listo el fix', done: true },
];

const view = deriveConversation({ ...emptyThread(), info: thread, items }, snapshot);

const renderModal = (props: Partial<React.ComponentProps<typeof GateStatusModal>> = {}) => {
  const onClose = vi.fn();
  const gate: ConversationGate = deriveConversationGate(view, snapshot);
  render(
    <I18nProvider initial="es">
      <GateStatusModal open onClose={onClose} thread={thread} view={view} gate={gate} snapshot={snapshot} {...props} />
    </I18nProvider>,
  );
  return onClose;
};

describe('GateStatusModal', () => {
  it('renders nothing when closed', () => {
    renderModal({ open: false });
    expect(screen.queryByTestId('gate-status-modal')).toBeNull();
  });

  it('summarizes conversation, FIX GATE, related fixes, participants and the last event', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: 'Estado del enjambre' })).toBeInTheDocument();
    expect(within(screen.getByTestId('gate-status-conversation')).getByText('Seguimos con el plan')).toBeInTheDocument();
    expect(screen.getByTestId('conversation-session')).toHaveTextContent('session-abc');
    expect(screen.getByTestId('gate-status-gate-label')).toHaveTextContent('FIX GATE FIX-e-burgos-005-006');
    expect(screen.queryByTestId('gate-status-tasks')).toBeNull();
    expect(screen.getByTestId('gate-status-fixes')).toHaveTextContent('FIX-e-burgos-005-006');
    expect(screen.getByTestId('gate-status-fixes')).toHaveTextContent('pending');
    expect(screen.getByTestId('gate-status-agents')).toHaveTextContent('2 eventos');
    expect(screen.getByTestId('gate-status-last-event')).toHaveTextContent('Listo el fix');
  });

  it('lists the tasks of the cycle with their status for a SPEC GATE', () => {
    renderModal({ gate: { kind: 'spec', specId: SPEC, cycle: 'cycle-01' } });
    const tasks = screen.getByTestId('gate-status-tasks');
    expect(tasks).toHaveTextContent('TASK-001');
    expect(tasks).toHaveTextContent('hecha');
    expect(tasks).toHaveTextContent('pendiente');
  });

  it('shows honest empty states for an idle empty conversation', () => {
    const emptyView = deriveConversation({ ...emptyThread(), info: thread }, snapshot);
    renderModal({ view: emptyView, gate: { kind: 'idle' } });
    expect(screen.getByTestId('gate-status-gate-label')).toHaveTextContent('IDLE');
    expect(screen.getByTestId('gate-status-gate')).toHaveTextContent('Sin gate activo en esta conversación');
    expect(screen.getByTestId('gate-status-fixes')).toHaveTextContent('Sin fixes relacionados');
    expect(screen.getByTestId('gate-status-agents')).toHaveTextContent('Ningún agente participó todavía');
    expect(screen.getByTestId('gate-status-last-event')).toHaveTextContent('Sin eventos todavía');
  });

  it('reports the missing conversation without inventing data', () => {
    renderModal({ thread: null, view: null, gate: { kind: 'idle' } });
    expect(screen.getByTestId('gate-status-no-conversation')).toBeInTheDocument();
    expect(screen.queryByTestId('gate-status-agents')).toBeNull();
  });

  it('closes with Escape, the close button and a backdrop click, but not from inside the panel', () => {
    const onClose = renderModal();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('gate-status-close'));
    fireEvent.click(screen.getByTestId('gate-status-modal'));
    expect(onClose).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByTestId('gate-status-conversation'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
