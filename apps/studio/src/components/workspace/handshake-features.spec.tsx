import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PROTOCOL_VERSION } from '@sdd-studio/protocol';
import { BridgeClient } from '@/lib/bridge/client';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { Composer } from './Composer';

class FakeSocket {
  static last: FakeSocket;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;
  sent: string[] = [];
  constructor(readonly url: string) {
    FakeSocket.last = this;
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
}

const snapshot = {
  agents: [{ id: 'sdd-planner', description: 'Planner' }],
  skills: [{ id: 'checklist', description: 'Lista', kind: 'skill', path: 'p' }],
};

async function connect(features?: string[]) {
  const client = new BridgeClient({ url: 'ws://x', token: 't', clientVersion: 'test', WebSocketImpl: FakeSocket as unknown as typeof WebSocket });
  client.connect();
  const socket = FakeSocket.last;
  act(() => {
    socket.onopen?.();
    socket.onmessage?.({
      data: JSON.stringify({
        kind: 'welcome', protocolVersion: PROTOCOL_VERSION, bridgeVersion: '0.1.0',
        workspace: { root: '/r', project: 'p' }, kitVersion: null, authMode: 'local-claude-login',
        ...(features ? { features } : {}),
      }),
    });
  });
  await waitFor(() => expect(client.state.status).toBe('open'));
  const store = createStudioStore();
  store.getState().setSnapshot(snapshot as never);
  const value = { client, store } as unknown as BridgeContextValue;
  render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <Composer channelId="general" threadId="t1" onThreadCreated={vi.fn()} />
      </BridgeContext.Provider>
    </I18nProvider>,
  );
  return { client, socket, box: screen.getByPlaceholderText('Escribí un mensaje… (/ para comandos)') };
}

describe('handshake without features (bridge of cycle-01)', () => {
  it('shows no attachment, file or catalog UI and sends no attachments or refs', async () => {
    const { client, socket, box } = await connect(undefined);
    expect(screen.queryByRole('button', { name: 'Adjuntar archivo' })).toBeNull();
    expect(screen.queryByTestId('attachment-input')).toBeNull();
    fireEvent.change(box, { target: { value: '@sdd-pl', selectionStart: 7 } });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.change(box, { target: { value: '/check', selectionStart: 6 } });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.change(box, { target: { value: '@sdd-planner hola', selectionStart: 17 } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(socket.sent.some((f) => f.includes('thread.send'))).toBe(true));
    const frame = JSON.parse(socket.sent.find((f) => f.includes('thread.send'))!);
    expect(frame).toMatchObject({ cmd: 'thread.send', text: '@sdd-planner hola', attachments: [], refs: { agents: [], skills: [] } });
    client.close();
  });

  it('shows each capability only when the welcome announces it', async () => {
    const { client, box } = await connect(['attachments', 'file-search', 'catalog']);
    expect(screen.getByRole('button', { name: 'Adjuntar archivo' })).toBeInTheDocument();
    expect(box).toHaveAttribute('role', 'combobox');
    client.close();
  });
});
