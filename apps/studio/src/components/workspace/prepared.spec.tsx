import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultThreadOptions, type ServerEvent, type WorkspaceSnapshot } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { Composer } from './Composer';
import { PreparedConversations } from './PreparedConversations';

const snapshot = {
  project: 'p', profile: 'solo', kitVersion: null, gateMode: 'block', pricing: null, stale: [], skills: [], agents: [], specs: [], fixes: [{ id: 'FIX-a-001', title: 'Arreglo', status: 'pending', severity: null, specId: null, createdAt: null, closedAt: null }],
  cycles: [{ specId: 'spec-a', cycle: 'cycle-01', status: 'in-progress', flow: 'lite', apps: ['apps/studio'], tasks: [], tasksTotal: 0, tasksDone: 0 }],
} as unknown as WorkspaceSnapshot;
const botEvent = (botKind: string, payload: Record<string, unknown>): ServerEvent => ({ kind: 'bot.event', channelId: 'general', botKind, payload } as ServerEvent);
const created = {
  id: 't1', channelId: 'spec:spec-a', title: 'x', agent: 'sdd-orchestrator', options: defaultThreadOptions(), status: 'idle', createdAt: 'a', lastActivity: 'a',
  link: { target: { kind: 'none' }, source: 'legacy' }, pendingCount: 0,
};

function setup() {
  const store = createStudioStore();
  store.getState().setSnapshot(snapshot);
  const client = { request: vi.fn(async () => created), supports: () => false };
  const value = { client, store } as unknown as BridgeContextValue;
  const onOpen = vi.fn();
  const onThreadCreated = vi.fn();
  const ui = (channelId: string) => (
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <PreparedConversations onOpen={onOpen} />
        <Composer channelId={channelId} threadId={null} onThreadCreated={onThreadCreated} />
      </BridgeContext.Provider>
    </I18nProvider>
  );
  return { store, client, onOpen, onThreadCreated, ui };
}

describe('PreparedConversations', () => {
  it('shows nothing until a spec, cycle or fix is created', () => {
    const { ui } = setup();
    render(ui('general'));
    expect(screen.queryByTestId('prepared-conversations')).toBeNull();
  });

  it('announces the new cycle and opens it with the minimal briefing', () => {
    const { store, onOpen, ui } = setup();
    render(ui('general'));
    act(() => store.getState().receive(botEvent('cycle.opened', { specId: 'spec-a', cycle: 'cycle-01', status: 'in-progress' })));
    expect(screen.getByText('Conversación nueva lista: spec-a · cycle-01')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    const [prepared, briefing] = onOpen.mock.calls[0] as [{ id: string }, string];
    expect(prepared.id).toBe('cycle:spec-a:cycle-01');
    expect(briefing).toContain('sdd/specs/spec-a/cycles/cycle-01/plan.md');
  });

  it('dismisses a prepared conversation', () => {
    const { store, ui } = setup();
    render(ui('general'));
    act(() => store.getState().receive(botEvent('fix.created', { fixId: 'FIX-a-001', specId: null })));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar conversación preparada' }));
    expect(screen.queryByTestId('prepared-conversations')).toBeNull();
    expect(store.getState().prepared).toEqual([]);
  });

  it('creates the thread associated to the cycle and clears the prepared one once sent', async () => {
    const { store, client, onThreadCreated, ui } = setup();
    render(ui('spec:spec-a'));
    act(() => store.getState().receive(botEvent('cycle.opened', { specId: 'spec-a', cycle: 'cycle-01', status: 'in-progress' })));
    const prepared = store.getState().prepared[0]!;
    const { briefingFor } = await import('@/lib/auto-conversation');
    const briefing = briefingFor(prepared, snapshot);
    act(() => store.getState().openPrepared(prepared.id));
    const box = screen.getByPlaceholderText('Escribí un mensaje… (/ para comandos)');
    fireEvent.change(box, { target: { value: briefing } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(onThreadCreated).toHaveBeenCalledWith('t1'));
    expect(client.request).toHaveBeenCalledWith(expect.objectContaining({ cmd: 'thread.create', channelId: 'spec:spec-a', link: { kind: 'cycle', specId: 'spec-a', cycle: 'cycle-01' } }));
    expect(store.getState().prepared).toEqual([]);
  });

  it('does not inherit the association when the dev sends something else', async () => {
    const { store, client, onThreadCreated, ui } = setup();
    render(ui('spec:spec-a'));
    act(() => store.getState().receive(botEvent('cycle.opened', { specId: 'spec-a', cycle: 'cycle-01', status: 'in-progress' })));
    act(() => store.getState().openPrepared(store.getState().prepared[0]!.id));
    const box = screen.getByPlaceholderText('Escribí un mensaje… (/ para comandos)');
    fireEvent.change(box, { target: { value: 'otra cosa distinta' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(onThreadCreated).toHaveBeenCalled());
    const sent = (client.request.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(sent).not.toHaveProperty('link');
    expect(store.getState().prepared).toHaveLength(1);
  });
});
