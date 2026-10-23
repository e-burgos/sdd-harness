import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ThreadEvent, ThreadInfo } from '@sdd-studio/protocol';
import { BridgeError } from '@/lib/bridge/client';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { Composer } from './Composer';
import { PendingMessages } from './PendingMessages';
import { Timeline } from './Timeline';

const options = { agent: 'sdd-planner', model: 'kit' as const, effort: null, permissionMode: 'default' as const };
const info = (status: ThreadInfo['status']): ThreadInfo => ({
  id: 't1', channelId: 'general', title: 'hilo', agent: 'sdd-planner', options, status, createdAt: '1', lastActivity: '1',
  link: { target: { kind: 'none' }, source: 'legacy' }, pendingCount: 0,
});

type Request = (cmd: { cmd: string } & Record<string, unknown>) => Promise<unknown>;

function mount(status: ThreadInfo['status'], events: ThreadEvent[] = [], request: Request = () => Promise.resolve(null)) {
  const store = createStudioStore();
  store.getState().setThreads([info(status)]);
  store.getState().loadHistory('t1', events.map((event, seq) => ({ seq, event })));
  const client = { request: vi.fn(request) };
  const value = { client, store, connection: { status: 'idle' } } as unknown as BridgeContextValue;
  const ui = (
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <Composer channelId="general" threadId="t1" onThreadCreated={vi.fn()} />
      </BridgeContext.Provider>
    </I18nProvider>
  );
  render(ui);
  let seq = events.length;
  const emit = (event: ThreadEvent) => act(() => store.getState().receive({ kind: 'thread.event', threadId: 't1', seq: seq++, event }));
  return { store, client, emit, box: () => screen.getByPlaceholderText('Escribí un mensaje… (/ para comandos)') };
}

const added = (id: string, text: string): ThreadEvent => ({ type: 'pending.added', pendingId: id, text });

describe('PendingMessages tray', () => {
  it('renders nothing without pending messages', () => {
    mount('running');
    expect(screen.queryByTestId('pending-messages')).toBeNull();
  });

  it('lists pending messages in order with a Pendiente badge distinct from the thread queued status (CA-015.5)', () => {
    mount('queued', [added('p1', 'uno'), added('p2', 'dos')]);
    const tray = screen.getByTestId('pending-messages');
    const rows = within(tray).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('uno'), expect.stringContaining('dos')]);
    expect(within(rows[0]!).getByText('Pendiente')).toBeInTheDocument();
    expect(within(tray).queryByText('en cola')).toBeNull();
    expect(within(tray).getByText(/Se entregan cuando termine la herramienta en curso/)).toBeInTheDocument();
  });

  it('moves a message out of the tray when it is delivered (pending to delivered)', () => {
    const { emit } = mount('running', [added('p1', 'uno')]);
    expect(screen.getByText('uno')).toBeInTheDocument();
    emit({ type: 'user.message', text: 'uno', pendingId: 'p1', delivery: 'cut-point' });
    expect(screen.queryByTestId('pending-messages')).toBeNull();
  });

  it('edits a pending message inline through thread.pending.edit', async () => {
    const { client, emit } = mount('running', [added('p1', 'uno')]);
    fireEvent.click(screen.getByRole('button', { name: 'Editar mensaje pendiente' }));
    fireEvent.change(screen.getByLabelText('Texto del mensaje pendiente'), { target: { value: 'uno corregido' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(client.request).toHaveBeenCalledWith({ cmd: 'thread.pending.edit', threadId: 't1', pendingId: 'p1', text: 'uno corregido' }));
    await waitFor(() => expect(screen.queryByLabelText('Texto del mensaje pendiente')).toBeNull());
    emit({ type: 'pending.edited', pendingId: 'p1', text: 'uno corregido' });
    expect(screen.getByText('uno corregido')).toBeInTheDocument();
  });

  it('does not allow saving an edit with empty text and points to removing instead (CA-014.4)', () => {
    const { client } = mount('running', [added('p1', 'uno')]);
    fireEvent.click(screen.getByRole('button', { name: 'Editar mensaje pendiente' }));
    fireEvent.change(screen.getByLabelText('Texto del mensaje pendiente'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    expect(screen.getByText('No puede quedar vacío: quitalo en su lugar.')).toBeInTheDocument();
    expect(client.request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('uno')).toBeInTheDocument();
  });

  it('removes a pending message through thread.pending.remove', async () => {
    const { client, emit } = mount('running', [added('p1', 'uno'), added('p2', 'dos')]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar mensaje pendiente' })[0]!);
    await waitFor(() => expect(client.request).toHaveBeenCalledWith({ cmd: 'thread.pending.remove', threadId: 't1', pendingId: 'p1' }));
    emit({ type: 'pending.removed', pendingId: 'p1' });
    expect(screen.queryByText('uno')).toBeNull();
    expect(screen.getByText('dos')).toBeInTheDocument();
  });

  it('shows a clear error and keeps the message when it was already delivered (CA-014.3)', async () => {
    mount('running', [added('p1', 'uno')], () => Promise.reject(new BridgeError('conflict', 'already delivered')));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar mensaje pendiente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El mensaje ya se entregó al modelo: no se puede editar ni quitar.');
    expect(screen.getByText('uno')).toBeInTheDocument();
  });

  it('offers to send pending messages when the thread is not working and flushes them (CA-015.2)', async () => {
    const { client } = mount('interrupted', [added('p1', 'uno')], () => Promise.resolve({ delivery: 'started' }));
    expect(screen.getByText(/enviá los pendientes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pendientes' }));
    await waitFor(() => expect(client.request).toHaveBeenCalledWith({ cmd: 'thread.pending.flush', threadId: 't1' }));
  });

  it('does not offer to flush while the thread is working', () => {
    mount('running', [added('p1', 'uno')]);
    expect(screen.queryByRole('button', { name: 'Enviar pendientes' })).toBeNull();
  });

  it('puts a reverted message back in the tray', () => {
    const { emit } = mount('running', [added('p1', 'uno'), { type: 'user.message', text: 'uno', pendingId: 'p1', delivery: 'cut-point' }]);
    expect(screen.queryByTestId('pending-messages')).toBeNull();
    emit({ type: 'pending.reverted', pendingId: 'p1', reason: 'interrupt' });
    expect(within(screen.getByTestId('pending-messages')).getByText('uno')).toBeInTheDocument();
  });
});

describe('Composer while the thread is working', () => {
  it.each(['running', 'waiting-approval', 'queued'] as const)('shows Encolar and sends without interrupting when %s (CA-013.1)', async (status) => {
    const { client, box } = mount(status, [], () => Promise.resolve({ delivery: 'pending', pendingId: 'p9' }));
    expect(screen.queryByRole('button', { name: 'Enviar' })).toBeNull();
    fireEvent.change(box(), { target: { value: 'cambio de plan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Encolar' }));
    await waitFor(() => expect(client.request).toHaveBeenCalledWith({ cmd: 'thread.send', threadId: 't1', text: 'cambio de plan' }));
    expect(client.request).not.toHaveBeenCalledWith(expect.objectContaining({ cmd: 'thread.interrupt' }));
    await waitFor(() => expect(box()).toHaveValue(''));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the plain Enviar button when the thread is idle (CA-013.5)', () => {
    mount('idle');
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Encolar' })).toBeNull();
  });

  it('shows the too-many-pending conflict and keeps the text', async () => {
    const { box } = mount('running', [], () => Promise.reject(new BridgeError('conflict', 'too many pending messages')));
    fireEvent.change(box(), { target: { value: 'otro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Encolar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('demasiados mensajes pendientes');
    expect(box()).toHaveValue('otro');
  });
});

describe('Timeline delivered labels', () => {
  const wrap = (events: ThreadEvent[]) => {
    const store = createStudioStore();
    store.getState().loadHistory('t1', events.map((event, seq) => ({ seq, event })));
    render(
      <I18nProvider initial="es">
        <Timeline items={store.getState().threads['t1']!.items} onRespond={vi.fn()} />
      </I18nProvider>,
    );
  };

  it('labels delivery at the cut point, as next turn, and a message that did not reach the model', () => {
    wrap([
      { type: 'user.message', text: 'normal' },
      { type: 'user.message', text: 'en corte', pendingId: 'p1', delivery: 'cut-point' },
      { type: 'user.message', text: 'siguiente', pendingId: 'p2', delivery: 'next-turn' },
      { type: 'user.message', text: 'perdido', pendingId: 'p3', delivery: 'cut-point' },
      { type: 'pending.reverted', pendingId: 'p3', reason: 'interrupt' },
    ]);
    expect(screen.getAllByText('Entregado')).toHaveLength(1);
    expect(screen.getByText('Entregado como siguiente turno')).toBeInTheDocument();
    expect(screen.getByText('No llegó al modelo: volvió a pendientes')).toBeInTheDocument();
  });
});
