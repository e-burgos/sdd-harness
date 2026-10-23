import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultThreadOptions } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import type { DraftAttachment } from '@/lib/attachments/draft-attachment';
import { clearDraft, draftKey, initialState, setDraftAttachments, setDraftText } from '@/lib/store/state';
import { createStudioStore, type StudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { Composer } from './Composer';

const PLACEHOLDER = 'Escribí un mensaje… (/ para comandos)';
const info = (id: string) => ({
  id, channelId: 'general', title: 'x', agent: 'sdd-orchestrator', options: defaultThreadOptions(), status: 'idle',
  createdAt: 'a', lastActivity: 'a', link: { target: { kind: 'none' }, source: 'legacy' }, pendingCount: 0,
});

function mount(store: StudioStore, channelId: string, threadId: string | null, request = vi.fn(async () => info('t1'))) {
  const value = { client: { request }, store } as unknown as BridgeContextValue;
  const ui = (cid: string, tid: string | null) => (
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <Composer key={`${cid}:${tid ?? ''}`} channelId={cid} threadId={tid} onThreadCreated={vi.fn()} />
      </BridgeContext.Provider>
    </I18nProvider>
  );
  const utils = render(ui(channelId, threadId));
  return { request, switchTo: (cid: string, tid: string | null) => utils.rerender(ui(cid, tid)), box: () => screen.getByPlaceholderText(PLACEHOLDER) };
}

describe('draft state', () => {
  it('keys drafts by thread id or by new:<channel>', () => {
    expect(draftKey('general', 't1')).toBe('t1');
    expect(draftKey('general', null)).toBe('new:general');
  });
  it('stores, replaces and removes drafts without touching others', () => {
    let s = setDraftText(initialState(), 'a', 'uno');
    s = setDraftText(s, 'b', 'dos');
    expect(s.drafts).toEqual({ a: { text: 'uno', attachments: [] }, b: { text: 'dos', attachments: [] } });
    s = setDraftText(s, 'a', '');
    expect(Object.keys(s.drafts)).toEqual(['b']);
    expect(setDraftText(s, 'zzz', '')).toBe(s);
    expect(setDraftText(s, 'b', 'dos')).toBe(s);
  });

  describe('attachments', () => {
    const attachment = (id: string, previewUrl?: string): DraftAttachment => ({
      id, kind: 'image', name: `${id}.png`, mime: 'image/png', size: 1, original: new Blob(['x']),
      encoded: { upload: { kind: 'image', name: `${id}.png`, mime: 'image/png', data: 'eA==', width: 1, height: 1 }, sha256: 'a'.repeat(64) },
      ...(previewUrl ? { previewUrl } : {}),
    });
    let revoke: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      revoke = vi.fn();
      URL.revokeObjectURL = revoke as never;
    });

    it('keeps a draft with attachments but no text and drops the key once both are empty', () => {
      let s = setDraftAttachments(initialState(), 'k', [attachment('a')]);
      expect(s.drafts['k']).toMatchObject({ text: '' });
      s = setDraftText(s, 'k', 'hola');
      s = setDraftAttachments(s, 'k', []);
      expect(s.drafts['k']).toEqual({ text: 'hola', attachments: [] });
      s = setDraftText(s, 'k', '');
      expect(s.drafts).toEqual({});
    });

    it('revokes only the preview URLs of removed attachments', () => {
      let s = setDraftAttachments(initialState(), 'k', [attachment('a', 'blob:a'), attachment('b', 'blob:b')]);
      s = setDraftAttachments(s, 'k', [s.drafts['k']!.attachments[1]!]);
      expect(revoke).toHaveBeenCalledTimes(1);
      expect(revoke).toHaveBeenCalledWith('blob:a');
    });

    it('clearDraft revokes every preview and removes the key', () => {
      let s = setDraftAttachments(initialState(), 'k', [attachment('a', 'blob:a'), attachment('b')]);
      s = setDraftText(s, 'k', 'hola');
      s = clearDraft(s, 'k');
      expect(s.drafts).toEqual({});
      expect(revoke).toHaveBeenCalledTimes(1);
      expect(clearDraft(s, 'k')).toBe(s);
    });

    it('keeps the attachments of each thread draft in the store when switching threads', () => {
      const store = createStudioStore();
      store.getState().setDraftAttachments('t1', [attachment('a')]);
      const { box, switchTo } = mount(store, 'general', 't1');
      fireEvent.change(box(), { target: { value: 'texto' } });
      switchTo('general', 't2');
      switchTo('general', 't1');
      expect(box()).toHaveValue('texto');
      expect(store.getState().drafts['t1']?.attachments).toHaveLength(1);
    });
  });
});

describe('Composer drafts', () => {
  it('keeps each thread draft intact when switching threads and back', () => {
    const store = createStudioStore();
    const { box, switchTo } = mount(store, 'general', 't1');
    fireEvent.change(box(), { target: { value: 'borrador uno' } });
    switchTo('general', 't2');
    expect(box()).toHaveValue('');
    fireEvent.change(box(), { target: { value: 'borrador dos' } });
    switchTo('general', 't1');
    expect(box()).toHaveValue('borrador uno');
    switchTo('general', 't2');
    expect(box()).toHaveValue('borrador dos');
  });

  it('keeps a separate draft for a new thread per channel', () => {
    const store = createStudioStore();
    const { box, switchTo } = mount(store, 'general', null);
    fireEvent.change(box(), { target: { value: 'nuevo general' } });
    switchTo('fixes', null);
    expect(box()).toHaveValue('');
    switchTo('general', null);
    expect(box()).toHaveValue('nuevo general');
  });

  it('discards the draft once the message is sent', async () => {
    const store = createStudioStore();
    const { box, request } = mount(store, 'general', 't1', vi.fn(async () => ({ delivery: 'started' })) as never);
    fireEvent.change(box(), { target: { value: 'hola' } });
    fireEvent.keyDown(box(), { key: 'Enter' });
    await waitFor(() => expect(request).toHaveBeenCalled());
    await waitFor(() => expect(store.getState().drafts).toEqual({}));
    expect(box()).toHaveValue('');
  });

  it('keeps the draft when the send fails', async () => {
    const store = createStudioStore();
    const { box } = mount(store, 'general', 't1', vi.fn(async () => { throw new Error('down'); }) as never);
    fireEvent.change(box(), { target: { value: 'hola' } });
    fireEvent.keyDown(box(), { key: 'Enter' });
    await screen.findByRole('alert');
    expect(store.getState().drafts['t1']?.text).toBe('hola');
  });

  it('loses drafts on reload because they live only in memory', () => {
    const first = createStudioStore();
    const { box } = mount(first, 'general', 't1');
    fireEvent.change(box(), { target: { value: 'efímero' } });
    expect(createStudioStore().getState().drafts).toEqual({});
  });
});
