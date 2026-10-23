import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { Sidebar } from './Sidebar';

const options = { agent: 'sdd-planner', model: 'kit' as const, effort: null, permissionMode: 'default' as const };
const thread = (over: Partial<ThreadInfo> & { id: string }): ThreadInfo => ({
  channelId: 'general', title: over.id, agent: 'sdd-planner', options, status: 'idle', createdAt: '1', lastActivity: '2026-01-01',
  link: { target: { kind: 'none' }, source: 'legacy' }, pendingCount: 0, ...over,
});
const base: WorkspaceSnapshot = {
  project: 'live', profile: 'team', kitVersion: null, gateMode: 'block', pricing: null, stale: [], skills: [], agents: [],
  specs: [{ id: 's1', title: 'Uno', status: 'in-progress', folder: 'f', module: null, app: null, dependsOn: [] }],
  cycles: [], fixes: [],
};

function mount(snapshot: WorkspaceSnapshot | null, threads: ThreadInfo[] = [], status: 'open' | 'reconnecting' = 'open') {
  window.localStorage.clear();
  const store = createStudioStore();
  if (snapshot) store.getState().setSnapshot(snapshot);
  store.getState().setThreads(threads);
  const connection = status === 'open' ? { status, welcome: { workspace: { project: 'live' }, authMode: null } } : { status };
  const value = { client: { request: vi.fn() }, store, connection, authMode: null, apiKeySource: null, setApiKey: vi.fn() } as unknown as BridgeContextValue;
  const onOpenThread = vi.fn();
  const onSelectChannel = vi.fn();
  render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <Sidebar view={{ channelId: 'general', threadId: null }} onSelectChannel={onSelectChannel} onOpenThread={onOpenThread} />
      </BridgeContext.Provider>
    </I18nProvider>,
  );
  return { store, onOpenThread, onSelectChannel };
}
const activeSection = () => screen.getByRole('button', { name: /^Hilos activos/ }).closest('section')!;

describe('Sidebar connected to the store', () => {
  it('updates the tree live when a new cycle appears in the workspace snapshot', () => {
    const { store } = mount(base);
    expect(screen.getByText('Sin ciclos')).toBeInTheDocument();
    act(() =>
      store.getState().receive({
        kind: 'workspace.changed', areas: ['specs'],
        snapshot: { ...base, cycles: [{ specId: 's1', cycle: 'cycle-01', status: 'in-progress', flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0 }] },
      }),
    );
    expect(screen.getByText('cycle-01')).toBeInTheDocument();
    expect(screen.queryByText('Sin ciclos')).toBeNull();
  });

  it('moves a reassigned thread to its new cycle without a reload', () => {
    const snap = { ...base, cycles: [
      { specId: 's1', cycle: 'cycle-01', status: 'in-progress', flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0 },
      { specId: 's1', cycle: 'cycle-02', status: 'in-progress', flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0 },
    ] };
    const link = (cycle: string): ThreadInfo['link'] => ({ target: { kind: 'cycle', specId: 's1', cycle }, source: 'manual' });
    const { store } = mount(snap, [thread({ id: 'mv', title: 'Movable', channelId: 'spec:s1', link: link('cycle-01') })]);
    const cycleRegion = (name: string) => screen.getByRole('button', { name }).closest('div')!;
    expect(within(cycleRegion('cycle-01')).getByRole('button', { name: 'Movable' })).toBeInTheDocument();
    act(() => store.getState().receive({ kind: 'thread.updated', thread: thread({ id: 'mv', title: 'Movable', channelId: 'spec:s1', link: link('cycle-02') }) }));
    expect(within(cycleRegion('cycle-02')).getByRole('button', { name: 'Movable' })).toBeInTheDocument();
    expect(within(cycleRegion('cycle-01')).queryByRole('button', { name: 'Movable' })).toBeNull();
  });

  it('adds and removes threads from the active list as their status changes', () => {
    const { store } = mount(base, [thread({ id: 'a', title: 'Alpha' })]);
    expect(within(activeSection()).getByText('Sin hilos activos')).toBeInTheDocument();
    act(() => store.getState().receive({ kind: 'thread.updated', thread: thread({ id: 'a', title: 'Alpha', status: 'running' }) }));
    expect(within(activeSection()).getByText('Alpha')).toBeInTheDocument();
    act(() => store.getState().receive({ kind: 'thread.updated', thread: thread({ id: 'a', title: 'Alpha', status: 'idle', lastActivity: '2026-02-01' }) }));
    expect(within(activeSection()).queryByText('Alpha')).toBeNull();
  });

  it('rebuilds the active list from threads already in the store after a reload', () => {
    mount(base, [thread({ id: 'a', title: 'Alpha', status: 'waiting-approval' }), thread({ id: 'b', title: 'Beta', status: 'running' })]);
    const rows = within(activeSection()).getAllByRole('button').slice(1).map((b) => b.textContent);
    expect(rows[0]).toContain('Alpha');
    expect(rows[1]).toContain('Beta');
  });

  it('opens a thread of another channel from the active list', () => {
    const { onOpenThread } = mount(base, [thread({ id: 'x', title: 'Elsewhere', status: 'running', channelId: 'spec:s1' })]);
    fireEvent.click(within(activeSection()).getByRole('button', { name: /Elsewhere/ }));
    expect(onOpenThread).toHaveBeenCalledWith(expect.objectContaining({ id: 'x', channelId: 'spec:s1' }));
  });

  it('marks the active list as possibly stale while reconnecting', () => {
    mount(base, [thread({ id: 'a', title: 'Alpha', status: 'running' })], 'reconnecting');
    expect(within(activeSection()).getByText('Estado posiblemente desactualizado')).toBeInTheDocument();
  });

  it('keeps legacy threads visible under their channel and spec threads without a cycle under their spec', () => {
    mount(base, [thread({ id: 'old', title: 'Legacy chat' }), thread({ id: 'orph', title: 'Orphan', channelId: 'spec:s1' })]);
    expect(screen.getByRole('button', { name: 'Legacy chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Orphan' })).toBeInTheDocument();
    expect(screen.getByText('Sin ciclo')).toBeInTheDocument();
  });

  it('never lists spec channels under Canales', () => {
    mount(base);
    const channels = screen.getByRole('button', { name: /^Canales/ }).closest('section')!;
    expect(within(channels).queryByText(/s1/)).toBeNull();
  });
});
