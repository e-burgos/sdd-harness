import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { browserImageCodec } from '@/lib/attachments/encode-image';
import { createStudioStore, type StudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { Composer } from './Composer';

const PLACEHOLDER = 'Escribí un mensaje… (/ para comandos)';
const JPEG_WITH_GPS = [0xff, 0xd8, 0xff, 0xe1, ...new TextEncoder().encode('Exif GPSLatitude 40.7')];

function mount(store: StudioStore, request = vi.fn(async () => ({ delivery: 'started' }))) {
  const value = { client: { request, supports: (f: string) => f === 'attachments' }, store } as unknown as BridgeContextValue;
  const ui = (threadId: string) => (
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <Composer key={threadId} channelId="general" threadId={threadId} onThreadCreated={vi.fn()} />
      </BridgeContext.Provider>
    </I18nProvider>
  );
  const utils = render(ui('t1'));
  return { request, switchTo: (id: string) => utils.rerender(ui(id)) };
}

const pick = (files: File[]) => fireEvent.change(screen.getByTestId('attachment-input'), { target: { files } });

describe('Composer attachments', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps the attachments and text of each thread draft when switching threads', async () => {
    const store = createStudioStore();
    const { switchTo } = mount(store);
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'borrador uno' } });
    pick([new File(['contenido'], 'uno.txt', { type: 'text/plain' })]);
    await screen.findByText('uno.txt');
    switchTo('t2');
    expect(screen.queryByText('uno.txt')).toBeNull();
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('');
    switchTo('t1');
    expect(screen.getByText('uno.txt')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('borrador uno');
  });

  it('loses attachments with the store (reload) and removing a chip drops it from the draft', async () => {
    const store = createStudioStore();
    mount(store);
    pick([new File(['x'], 'a.txt', { type: 'text/plain' })]);
    await screen.findByText('a.txt');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar a.txt' }));
    expect(store.getState().drafts['t1']).toBeUndefined();
  });

  it('sends the re-encoded image without EXIF/GPS and never the original bytes', async () => {
    vi.spyOn(browserImageCodec, 'decode').mockResolvedValue({ width: 4000, height: 2000 });
    const encode = vi.spyOn(browserImageCodec, 'encode').mockImplementation(async (_b, _w, _h, type) => new Blob(['pixels-limpios'], { type }));
    const store = createStudioStore();
    const { request } = mount(store);
    pick([new File([new Uint8Array(JPEG_WITH_GPS)], 'foto.jpg', { type: 'image/jpeg' })]);
    await screen.findByText('foto.jpg');
    expect(encode).toHaveBeenCalledWith(expect.anything(), 1568, 784, 'image/jpeg', 0.85);
    fireEvent.keyDown(screen.getByPlaceholderText(PLACEHOLDER), { key: 'Enter' });
    await waitFor(() => expect(request).toHaveBeenCalled());
    const sent = (request.mock.calls[0] as unknown as [{ attachments: { data: string; width: number; height: number }[] }])[0].attachments[0]!;
    expect(atob(sent.data)).toBe('pixels-limpios');
    expect(atob(sent.data)).not.toContain('GPS');
    expect(sent).toMatchObject({ width: 1568, height: 784 });
  });

  it('rejects an image whose re-encode fails instead of sending the original', async () => {
    vi.spyOn(browserImageCodec, 'decode').mockResolvedValue({ width: 10, height: 10 });
    vi.spyOn(browserImageCodec, 'encode').mockResolvedValue(null);
    const store = createStudioStore();
    mount(store);
    pick([new File([new Uint8Array(JPEG_WITH_GPS)], 'foto.jpg', { type: 'image/jpeg' })]);
    expect(await screen.findByText('foto.jpg: no se pudo procesar la imagen.')).toBeInTheDocument();
    expect(store.getState().drafts['t1']).toBeUndefined();
  });
});
