import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultThreadOptions } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { draftKey, initialState, setDraft } from '@/lib/store/state';
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
    let s = setDraft(initialState(), 'a', 'uno');
    s = setDraft(s, 'b', 'dos');
    expect(s.drafts).toEqual({ a: 'uno', b: 'dos' });
    s = setDraft(s, 'a', '');
    expect(s.drafts).toEqual({ b: 'dos' });
    expect(setDraft(s, 'zzz', '')).toBe(s);
    expect(setDraft(s, 'b', 'dos')).toBe(s);
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
    const { box, request } = mount(store, 'general', 't1', vi.fn(async () => ({})) as never);
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
    expect(store.getState().drafts['t1']).toBe('hola');
  });

  it('loses drafts on reload because they live only in memory', () => {
    const first = createStudioStore();
    const { box } = mount(first, 'general', 't1');
    fireEvent.change(box(), { target: { value: 'efímero' } });
    expect(createStudioStore().getState().drafts).toEqual({});
  });
});
