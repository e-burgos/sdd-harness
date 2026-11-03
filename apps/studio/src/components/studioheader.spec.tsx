import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useTheme } from '@e-burgos/tucu-ui';
import type { ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from './BridgeProvider';
import { StudioHeader } from './StudioHeader';

const SPEC = 'spec-e-burgos-005-sessions';

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
  cycles: [],
  fixes: [{ id: 'FIX-e-burgos-005-006', title: 'F', status: 'pending', severity: null, specId: SPEC, createdAt: null, closedAt: null }],
};

const info = (id: string, lastActivity: string): ThreadInfo => ({
  id,
  channelId: 'general',
  title: id,
  agent: 'sdd-orchestrator',
  options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' },
  status: 'idle',
  createdAt: '2026-01-01T00:00:00Z',
  lastActivity,
  link: { target: { kind: 'none' }, source: 'legacy' },
  pendingCount: 0,
});

function mount(store = createStudioStore()) {
  const value = { client: {}, store, connection: { status: 'open' } } as unknown as BridgeContextValue;
  render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <StudioHeader />
      </BridgeContext.Provider>
    </I18nProvider>,
  );
  return store;
}

const writeEvent = (path: string) => ({ type: 'tool.start' as const, toolUseId: path, author: { agent: 'sdd-reviewer', parentToolUseId: null }, tool: 'Write', summary: path });

describe('StudioHeader gate chip', () => {
  it('shows IDLE without conversation or active cycle', () => {
    mount();
    expect(screen.getByTestId('gate-chip')).toHaveTextContent('IDLE');
    expect(screen.getByTestId('gate-chip')).toHaveAttribute('data-gate', 'idle');
  });

  it('falls back to the global in-progress cycle when there is no conversation', () => {
    const store = createStudioStore();
    store.getState().setSnapshot({ ...snapshot, cycles: [{ specId: SPEC, cycle: 'cycle-03', status: 'in-progress', flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0 }] });
    mount(store);
    expect(screen.getByTestId('gate-chip')).toHaveTextContent(`SPEC GATE ${SPEC} cycle-03`);
  });

  it('reflects the selected conversation: FIX GATE for one and SPEC GATE for the other', () => {
    const store = createStudioStore();
    store.getState().setSnapshot(snapshot);
    store.getState().setThreads([info('fixing', '2026-02-01T00:00:00Z'), info('speccing', '2026-01-01T00:00:00Z')]);
    store.getState().loadHistory('fixing', [{ seq: 0, event: writeEvent(`sdd/specs/${SPEC}/fixes/fix-e-burgos-005-006.md`) }]);
    store.getState().loadHistory('speccing', [{ seq: 0, event: writeEvent(`sdd/specs/${SPEC}/cycles/cycle-01/plan.md`) }]);
    mount(store);
    expect(screen.getByTestId('gate-chip')).toHaveTextContent('FIX GATE FIX-e-burgos-005-006');
    act(() => store.getState().selectThread('speccing'));
    expect(screen.getByTestId('gate-chip')).toHaveTextContent(`SPEC GATE ${SPEC} cycle-01`);
  });

  it('opens the swarm status modal from the chip and closes it with Escape', () => {
    const store = createStudioStore();
    store.getState().setSnapshot(snapshot);
    store.getState().setThreads([info('fixing', '2026-02-01T00:00:00Z')]);
    store.getState().loadHistory('fixing', [{ seq: 0, event: writeEvent(`sdd/specs/${SPEC}/fixes/fix-e-burgos-005-006.md`) }]);
    mount(store);
    expect(screen.queryByTestId('gate-status-modal')).toBeNull();
    fireEvent.click(screen.getByTestId('gate-chip'));
    expect(screen.getByTestId('gate-status-gate-label')).toHaveTextContent('FIX GATE FIX-e-burgos-005-006');
    fireEvent.keyDown(screen.getByTestId('gate-status-modal'), { key: 'Escape' });
    expect(screen.queryByTestId('gate-status-modal')).toBeNull();
  });

  it('opens the modal without a conversation and reports it', () => {
    mount();
    fireEvent.click(screen.getByTestId('gate-chip'));
    expect(screen.getByTestId('gate-status-no-conversation')).toBeInTheDocument();
  });
});

describe('StudioHeader gate mode', () => {
  it('shows the SPEC GATE mode and follows a change made from the Kit tools', () => {
    const store = createStudioStore();
    store.getState().setSnapshot({ ...snapshot, tools: { status: 'ok', rtkEnabled: true, modEnabled: true, gate: 'block', modLinked: true, revision: 'aaaaaaaaaaaaaaaa' } });
    mount(store);
    expect(screen.getByTestId('gate-chip')).toHaveAttribute('data-gate-mode', 'block');
    expect(screen.getByTestId('gate-mode')).toHaveTextContent('Bloquear');
    act(() => store.getState().setSnapshot({ ...snapshot, tools: { status: 'ok', rtkEnabled: true, modEnabled: true, gate: 'warn', modLinked: true, revision: 'bbbbbbbbbbbbbbbb' } }));
    expect(screen.getByTestId('gate-chip')).toHaveAttribute('data-gate-mode', 'warn');
    expect(screen.getByTestId('gate-mode')).toHaveTextContent('Avisar');
  });
});

describe('StudioHeader mode toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    useTheme.setState({ mode: 'dark' });
  });

  it('switches between dark and light and labels the action it will perform', () => {
    mount();
    fireEvent.click(screen.getByTestId('mode-toggle'));
    expect(useTheme.getState().mode).toBe('light');
    expect(screen.getByTestId('mode-toggle')).toHaveAccessibleName('Cambiar a modo oscuro');
    fireEvent.click(screen.getByTestId('mode-toggle'));
    expect(useTheme.getState().mode).toBe('dark');
    expect(screen.getByTestId('mode-toggle')).toHaveAccessibleName('Cambiar a modo claro');
  });

  it('persists the chosen mode across a remount', () => {
    const first = mount();
    fireEvent.click(screen.getByTestId('mode-toggle'));
    expect(JSON.parse(localStorage.getItem('theme-storage') ?? '{}').state.mode).toBe('light');
    cleanup();
    mount(first);
    expect(screen.getByTestId('mode-toggle')).toHaveAccessibleName('Cambiar a modo oscuro');
  });

  it('keeps the language toggle in the header', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'es' }));
    expect(screen.getByRole('button', { name: 'en' })).toBeInTheDocument();
  });
});
