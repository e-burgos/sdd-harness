import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { useAttachmentDraft } from '@/lib/use-attachment-draft';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { AttachmentTray } from './AttachmentTray';

function setup() {
  const store = createStudioStore();
  const value = { client: { request: vi.fn() }, store } as unknown as BridgeContextValue;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>
    </I18nProvider>
  );
  return { store, wrapper };
}

const note = (name: string, text = 'hola') => new File([text], name, { type: 'text/plain' });

function Harness({ draftKey }: { draftKey: string }) {
  const draft = useAttachmentDraft(draftKey);
  return (
    <>
      <button onClick={() => void draft.add(Array.from({ length: 6 }, (_, i) => note(`n${i}.txt`, `t${i}`)))}>add6</button>
      <AttachmentTray attachments={draft.attachments} failures={draft.failures} onRemove={draft.remove} onDismissFailures={draft.dismissFailures} />
    </>
  );
}

describe('useAttachmentDraft and AttachmentTray', () => {
  it('rejects the sixth attachment with a notice and shows the n/5 counter', async () => {
    const { wrapper } = setup();
    render(<Harness draftKey="new:general" />, { wrapper });
    fireEvent.click(screen.getByText('add6'));
    expect(await screen.findByText('5/5 adjuntos')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Máximo 5 adjuntos por mensaje.');
  });

  it('removing a chip updates the list and the counter', async () => {
    const { wrapper } = setup();
    render(<Harness draftKey="new:general" />, { wrapper });
    fireEvent.click(screen.getByText('add6'));
    await screen.findByText('5/5 adjuntos');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar n0.txt' }));
    expect(screen.getByText('4/5 adjuntos')).toBeInTheDocument();
    expect(screen.queryByText('n0.txt')).toBeNull();
  });

  it('reports unsupported files and failed image re-encodes per file', async () => {
    const { wrapper, store } = setup();
    const { result } = renderHook(() => useAttachmentDraft('new:general'), { wrapper });
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'a.png', { type: 'image/png' });
    await act(async () => result.current.add([new File(['x'], 'run.exe'), png]));
    expect(result.current.failures).toEqual([
      { name: 'run.exe', reason: 'unsupported' },
      { name: 'a.png', reason: 'image-encode' },
    ]);
    expect(store.getState().drafts['new:general']).toBeUndefined();
  });

  it('keeps attachments per draft key and builds uploads from them', async () => {
    const { wrapper, store } = setup();
    const a = renderHook(() => useAttachmentDraft('t1'), { wrapper });
    const b = renderHook(() => useAttachmentDraft('t2'), { wrapper });
    await act(async () => a.result.current.add([note('a.txt', 'uno')]));
    expect(a.result.current.attachments).toHaveLength(1);
    expect(b.result.current.attachments).toHaveLength(0);
    const encoded = await a.result.current.buildUploads((uploads) => ({ cmd: 'thread.send', attachments: uploads }));
    expect(encoded[0]!.upload).toMatchObject({ kind: 'text', text: 'uno' });
    expect(encoded[0]!.sha256).toMatch(/^[a-f0-9]{64}$/);
    await waitFor(() => expect(store.getState().drafts['t1']?.attachments).toHaveLength(1));
  });

  it('renders nothing when there is nothing to show and the drop hint while dragging', () => {
    const { wrapper } = setup();
    const { container, rerender } = render(<AttachmentTray attachments={[]} failures={[]} onRemove={vi.fn()} onDismissFailures={vi.fn()} />, { wrapper });
    expect(container).toBeEmptyDOMElement();
    rerender(<AttachmentTray attachments={[]} failures={[]} dragging onRemove={vi.fn()} onDismissFailures={vi.fn()} />);
    expect(screen.getByText('Soltá los archivos para adjuntarlos')).toBeInTheDocument();
  });
});
