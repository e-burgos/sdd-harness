import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AttachmentRef } from '@sdd-studio/protocol';
import { sha256Hex } from '@/lib/attachments/bytes';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { AttachmentView } from './AttachmentView';
import { PendingMessages } from './PendingMessages';
import { Timeline } from './Timeline';

const SHA_FOR = new Map<string, string>();

async function refFor(text: string, extra: Partial<AttachmentRef> = {}): Promise<AttachmentRef> {
  const bytes = new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>;
  const sha256 = await sha256Hex(bytes);
  SHA_FOR.set(sha256, btoa(text));
  return { sha256, kind: 'text', mime: 'text/plain', name: 'nota.txt', size: bytes.length, ...extra } as AttachmentRef;
}

function mount(ui: React.ReactNode, request: (cmd: { cmd: string; sha256?: string; mime?: string }) => Promise<unknown>) {
  const store = createStudioStore();
  const client = { request: vi.fn(request), supports: () => true };
  const value = { client, store } as unknown as BridgeContextValue;
  render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>{ui}</BridgeContext.Provider>
    </I18nProvider>,
  );
  return { client, store };
}

const served = async (cmd: { sha256?: string; mime?: string }) => ({ sha256: cmd.sha256, mime: cmd.mime, data: SHA_FOR.get(cmd.sha256!) });

describe('AttachmentView', () => {
  it('reserves the image box by width and height before the content arrives and then shows the image', async () => {
    const ref = await refFor('imagen', { kind: 'image', mime: 'image/png', name: 'foto.png', width: 200, height: 100 });
    mount(<AttachmentView attachment={ref} />, served);
    const box = screen.getByTestId('attachment-image-box');
    expect(box).toHaveStyle({ width: '200px', aspectRatio: '200 / 100' });
    expect(await screen.findByRole('img', { name: 'foto.png' })).toHaveAttribute('src');
    expect(screen.getByRole('link', { name: 'foto.png' })).toHaveAttribute('target', '_blank');
  });

  it('shows the unavailable marker without breaking when the content cannot be fetched', async () => {
    const ref = await refFor('perdido', { kind: 'image', mime: 'image/png', name: 'foto.png', width: 10, height: 10 });
    mount(<AttachmentView attachment={ref} />, async () => { throw new Error('not-found'); });
    expect(await screen.findByRole('img', { name: 'Adjunto no disponible: foto.png' })).toBeInTheDocument();
  });

  it('shows a PDF card with an open link', async () => {
    const ref = await refFor('%PDF-1', { kind: 'pdf', mime: 'application/pdf', name: 'doc.pdf' });
    mount(<AttachmentView attachment={ref} />, served);
    expect(screen.getByText('doc.pdf')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Abrir' })).toHaveAttribute('target', '_blank');
  });

  it('expands a text attachment into a bounded pre', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ text: async () => 'cuerpo del archivo' })));
    const ref = await refFor('cuerpo del archivo');
    mount(<AttachmentView attachment={ref} />, served);
    fireEvent.click(screen.getByRole('button', { name: 'Ver contenido' }));
    expect(await screen.findByText('cuerpo del archivo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contenido' }));
    expect(screen.queryByText('cuerpo del archivo')).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('Timeline and PendingMessages with attachments', () => {
  it('renders attachments and refs of a user message, also without text', async () => {
    const ref = await refFor('x', { kind: 'pdf', mime: 'application/pdf', name: 'doc.pdf' });
    const items = [{ kind: 'user', id: 'u1', seq: 1, text: '', attachments: [ref], refs: { agents: ['sdd-planner'], skills: ['review'] } }] as never;
    mount(<Timeline items={items} status="idle" onRespond={vi.fn()} />, served);
    expect(screen.getByText('doc.pdf')).toBeInTheDocument();
    expect(screen.getByText('@sdd-planner')).toBeInTheDocument();
    expect(screen.getByText('/review')).toBeInTheDocument();
  });

  it('shows read-only attachment chips on a pending message and lets an attachment-only one be saved empty', async () => {
    const ref = await refFor('y', { name: 'adjunto.txt' });
    const { store, client } = mount(<PendingMessages threadId="t1" />, async () => ({}));
    store.setState({ threads: { t1: { info: { status: 'running' }, pending: [{ id: 'p1', text: '', attachments: [ref] }], items: [], touched: [], lastSeq: -1, synced: true, buffer: [] } } } as never);
    expect(await screen.findByText('adjunto.txt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar mensaje pendiente' }));
    expect(screen.queryByText('No puede quedar vacío: quitalo en su lugar.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(client.request).toHaveBeenCalledWith({ cmd: 'thread.pending.edit', threadId: 't1', pendingId: 'p1', text: '' }));
  });
});

