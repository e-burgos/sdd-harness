import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ThreadEvent, ThreadInfo } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { createStudioStore } from '@/lib/store/store';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { ThreadView } from './ThreadView';

const options = { agent: 'sdd-planner', model: 'kit' as const, effort: null, permissionMode: 'default' as const };
const info = (id: string): ThreadInfo => ({
  id, channelId: 'general', title: id, agent: 'sdd-planner', options, status: 'running', createdAt: '1', lastActivity: '1',
  link: { target: { kind: 'none' }, source: 'legacy' }, pendingCount: 0,
});
const author = { agent: 'sdd-planner', parentToolUseId: null };

const observers: { callback: ResizeObserverCallback }[] = [];
class ControlledResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    observers.push({ callback });
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
const resizeAll = () => act(() => observers.forEach((o) => o.callback([], o as unknown as ResizeObserver)));

interface Geometry {
  scrollHeight: number;
  clientHeight: number;
}
function setGeometry(el: HTMLElement, g: Geometry) {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => g.scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => g.clientHeight });
}
const scrollTo = (el: HTMLElement, top: number) => {
  el.scrollTop = top;
  fireEvent.scroll(el);
};

function setup(events: ThreadEvent[] = [{ type: 'user.message', text: 'hola' }], threadId = 't1') {
  const store = createStudioStore();
  store.getState().setThreads([info(threadId)]);
  store.getState().loadHistory(threadId, events.map((event, seq) => ({ seq, event })));
  const value = { client: { request: vi.fn(), supports: () => false }, store, connection: { status: 'idle' } } as unknown as BridgeContextValue;
  const ui = (id: string) => (
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <ThreadView key={id} threadId={id} onBack={vi.fn()} composer={null} />
      </BridgeContext.Provider>
    </I18nProvider>
  );
  const utils = render(ui(threadId));
  const scroller = screen.getByTestId('thread-scroller');
  const geometry: Geometry = { scrollHeight: 1000, clientHeight: 400 };
  setGeometry(scroller, geometry);
  return { store, scroller, geometry, rerender: (id: string) => utils.rerender(ui(id)), threadId };
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal('ResizeObserver', ControlledResizeObserver);
});
afterEach(() => vi.unstubAllGlobals());

describe('ThreadView scrolling', () => {
  it('follows content that grows while at the bottom (streaming, images)', () => {
    const { scroller, geometry } = setup();
    scrollTo(scroller, 600);
    geometry.scrollHeight = 1300;
    resizeAll();
    expect(scroller.scrollTop).toBe(1300);
  });

  it('follows streamed text that does not change the item count', () => {
    const { store, scroller, geometry, threadId } = setup([
      { type: 'message.start', messageId: 'm1', author },
      { type: 'message.delta', messageId: 'm1', text: 'a' },
    ]);
    scrollTo(scroller, 600);
    act(() => store.getState().receive({ kind: 'thread.event', threadId, seq: 5, event: { type: 'message.delta', messageId: 'm1', text: ' more' } }));
    geometry.scrollHeight = 1100;
    resizeAll();
    expect(scroller.scrollTop).toBe(1100);
  });

  it('does not move when the reader scrolled up and offers a way back', () => {
    const { scroller, geometry } = setup();
    scrollTo(scroller, 100);
    expect(screen.getByRole('button', { name: 'Ir al final' })).toBeInTheDocument();
    geometry.scrollHeight = 1300;
    resizeAll();
    expect(scroller.scrollTop).toBe(100);
    fireEvent.click(screen.getByRole('button', { name: 'Ir al final' }));
    expect(scroller.scrollTop).toBe(1300);
    expect(screen.queryByRole('button', { name: 'Ir al final' })).toBeNull();
  });

  it('keeps the reading position while new messages and streamed text arrive after scrolling up (CA-012.2)', () => {
    const { store, scroller, geometry, threadId } = setup();
    scrollTo(scroller, 100);
    const receive = (seq: number, event: ThreadEvent) => act(() => store.getState().receive({ kind: 'thread.event', threadId, seq, event }));
    geometry.scrollHeight = 1400;
    receive(10, { type: 'message.start', messageId: 'm1', author });
    receive(11, { type: 'message.delta', messageId: 'm1', text: 'streaming…' });
    resizeAll();
    expect(scroller.scrollTop).toBe(100);
    expect(screen.getByRole('button', { name: 'Ir al final' })).toBeInTheDocument();
  });

  it('hides the jump control while at the bottom', () => {
    const { scroller } = setup();
    scrollTo(scroller, 600);
    expect(screen.queryByRole('button', { name: 'Ir al final' })).toBeNull();
  });

  it('treats up to 48px from the bottom as the bottom and more than that as scrolled up', () => {
    const { scroller, geometry } = setup();
    scrollTo(scroller, 600 - 48);
    geometry.scrollHeight = 1200;
    resizeAll();
    expect(scroller.scrollTop).toBe(1200);
    scrollTo(scroller, 1200 - 400 - 60);
    geometry.scrollHeight = 1400;
    resizeAll();
    expect(scroller.scrollTop).toBe(1200 - 400 - 60);
  });

  it('sends the view to the bottom when the user sends a message while scrolled up', () => {
    const { store, scroller, geometry, threadId } = setup();
    scrollTo(scroller, 50);
    geometry.scrollHeight = 1500;
    act(() => store.getState().receive({ kind: 'thread.event', threadId, seq: 9, event: { type: 'user.message', text: 'otro' } }));
    expect(scroller.scrollTop).toBe(1500);
  });

  it('positions an existing thread at the end once its history is synced', () => {
    const store = createStudioStore();
    store.getState().setThreads([info('t1')]);
    const value = { client: { request: vi.fn(), supports: () => false }, store, connection: { status: 'idle' } } as unknown as BridgeContextValue;
    render(
      <I18nProvider initial="es">
        <BridgeContext.Provider value={value}>
          <ThreadView threadId="t1" onBack={vi.fn()} composer={null} />
        </BridgeContext.Provider>
      </I18nProvider>,
    );
    const scroller = screen.getByTestId('thread-scroller');
    setGeometry(scroller, { scrollHeight: 2000, clientHeight: 400 });
    scrollTo(scroller, 0);
    act(() => store.getState().loadHistory('t1', [{ seq: 0, event: { type: 'user.message', text: 'hola' } }]));
    expect(scroller.scrollTop).toBe(2000);
  });

  it('starts at the bottom of another thread when the view is keyed by thread id', () => {
    const { store, scroller, rerender } = setup();
    scrollTo(scroller, 0);
    store.getState().setThreads([info('t2')]);
    store.getState().loadHistory('t2', [{ seq: 0, event: { type: 'user.message', text: 'dos' } }]);
    rerender('t2');
    const next = screen.getByTestId('thread-scroller');
    expect(next).not.toBe(scroller);
    setGeometry(next, { scrollHeight: 900, clientHeight: 400 });
    resizeAll();
    expect(next.scrollTop).toBe(900);
  });

  it('reserves a fixed-height activity row so indicators do not shift the content', () => {
    setup();
    expect(screen.getByTestId('thread-activity')).toHaveClass('h-6');
  });
});
