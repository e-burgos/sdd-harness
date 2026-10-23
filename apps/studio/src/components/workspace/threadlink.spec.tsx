import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { BridgeError } from '@/lib/bridge/client';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { ThreadLinkPicker } from './ThreadLinkPicker';

const options = { agent: 'sdd-planner', model: 'kit' as const, effort: null, permissionMode: 'default' as const };
const thread = (link: ThreadInfo['link']): ThreadInfo => ({
  id: 't1', channelId: 'spec:s1', title: 'hilo', agent: 'sdd-planner', options, status: 'idle', createdAt: '1', lastActivity: '1', link, pendingCount: 0,
});
const cycle = (specId: string, n: string, status: string) => ({ specId, cycle: n, status, flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0 });
const snapshot: WorkspaceSnapshot = {
  project: 'p', profile: 'team', kitVersion: null, gateMode: 'block', pricing: null, stale: [], skills: [], agents: [], specs: [],
  cycles: [cycle('s1', 'cycle-01', 'completed'), cycle('s1', 'cycle-02', 'in-progress')],
  fixes: [{ id: 'FIX-a-001', title: 'x', status: 'pending', severity: null, specId: null, createdAt: null, closedAt: null }],
};

function mount(request: (cmd: { cmd: string; link?: unknown }) => Promise<unknown>, link: ThreadInfo['link'] = { target: { kind: 'cycle', specId: 's1', cycle: 'cycle-02' }, source: 'auto' }) {
  const store = createStudioStore();
  store.getState().setSnapshot(snapshot);
  store.getState().setThreads([thread(link)]);
  const client = { request: vi.fn(request) };
  const value = { client, store, connection: { status: 'idle' } } as unknown as BridgeContextValue;
  render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <ThreadLinkPicker threadId="t1" />
      </BridgeContext.Provider>
    </I18nProvider>,
  );
  return { store, client, select: screen.getByLabelText('Asociado a') as HTMLSelectElement };
}

describe('ThreadLinkPicker', () => {
  it('offers every cycle, every fix and no link, with the current link selected', () => {
    const { select } = mount(() => Promise.resolve(null));
    expect(select.value).toBe('cycle:s1/cycle-02');
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Sin asociar', 's1 · cycle-01 (completed)', 's1 · cycle-02 (in-progress)', 'FIX-a-001 (pending)',
    ]);
  });

  it('reassigns to another cycle with thread.setLink and updates the store', async () => {
    const { select, client, store } = mount((cmd) =>
      Promise.resolve({ ...thread({ target: cmd.link as never, source: 'manual' }) }),
    );
    fireEvent.change(select, { target: { value: 'cycle:s1/cycle-01' } });
    await waitFor(() => expect(store.getState().threads['t1']?.info?.link).toEqual({ target: { kind: 'cycle', specId: 's1', cycle: 'cycle-01' }, source: 'manual' }));
    expect(client.request).toHaveBeenCalledWith({ cmd: 'thread.setLink', threadId: 't1', link: { kind: 'cycle', specId: 's1', cycle: 'cycle-01' } });
    expect(select.value).toBe('cycle:s1/cycle-01');
  });

  it('reassigns to a fix and clears the link', async () => {
    const { select, client } = mount((cmd) => Promise.resolve(thread({ target: cmd.link as never, source: 'manual' })));
    fireEvent.change(select, { target: { value: 'fix:FIX-a-001' } });
    await waitFor(() => expect(select.value).toBe('fix:FIX-a-001'));
    expect(client.request).toHaveBeenLastCalledWith({ cmd: 'thread.setLink', threadId: 't1', link: { kind: 'fix', fixId: 'FIX-a-001' } });
    fireEvent.change(select, { target: { value: 'none' } });
    await waitFor(() => expect(select.value).toBe('none'));
    expect(client.request).toHaveBeenLastCalledWith({ cmd: 'thread.setLink', threadId: 't1', link: { kind: 'none' } });
  });

  it('keeps the previous link and shows the error when the reassignment fails', async () => {
    const { select, store } = mount(() => Promise.reject(new BridgeError('not-found', 'the link target does not exist')));
    fireEvent.change(select, { target: { value: 'fix:FIX-a-001' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo reasignar el hilo: the link target does not exist');
    expect(select.value).toBe('cycle:s1/cycle-02');
    expect(store.getState().threads['t1']?.info?.link.target).toEqual({ kind: 'cycle', specId: 's1', cycle: 'cycle-02' });
    expect(select).toBeEnabled();
  });

  it('follows a link changed from another tab through thread.updated', () => {
    const { select, store } = mount(() => Promise.resolve(null));
    act(() => store.getState().receive({ kind: 'thread.updated', thread: thread({ target: { kind: 'fix', fixId: 'FIX-a-001' }, source: 'manual' }) }));
    expect(select.value).toBe('fix:FIX-a-001');
  });

  it('keeps showing a link whose target is not in the snapshot', () => {
    const { select } = mount(() => Promise.resolve(null), { target: { kind: 'fix', fixId: 'FIX-old-009' }, source: 'legacy' });
    expect(select.value).toBe('fix:FIX-old-009');
  });
});
