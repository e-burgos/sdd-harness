import { act, render, screen } from '@testing-library/react';
import { BridgeProvider, useBridge } from './BridgeProvider';

const h = vi.hoisted(() => {
  const pending: { resolve(): void; reject(e: unknown): void }[] = [];
  const listeners: { state: ((s: unknown) => void) | null } = { state: null };
  return { pending, listeners };
});

vi.mock('@/lib/bootstrap', () => ({
  bootstrap: () => new Promise<void>((resolve, reject) => h.pending.push({ resolve, reject })),
}));
vi.mock('@/lib/bridge/client', () => ({
  BridgeError: class BridgeError extends Error {
    code = 'x';
  },
  BridgeClient: class {
    state = { status: 'idle' };
    onState(fn: (s: unknown) => void) {
      h.listeners.state = fn;
      return () => undefined;
    }
    onEvent() {
      return () => undefined;
    }
    connect() {}
    close() {}
  },
}));
vi.mock('@/lib/store/store', () => ({ createStudioStore: () => ({ getState: () => ({ receive() {} }) }) }));

function Probe() {
  const { syncError } = useBridge();
  return <p data-testid="err">{syncError ?? 'none'}</p>;
}
const open = () => act(() => h.listeners.state?.({ status: 'open' }));

describe('BridgeProvider sync', () => {
  beforeEach(() => {
    h.pending.length = 0;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<BridgeProvider pairing={{ port: 1, token: 'x'.repeat(20) }}><Probe /></BridgeProvider>);
  });

  it('ignores the error of a stale sync run', async () => {
    open();
    open();
    await act(async () => h.pending[0]!.reject(new Error('old')));
    expect(screen.getByTestId('err')).toHaveTextContent('none');
    await act(async () => h.pending[1]!.reject(new Error('new')));
    expect(screen.getByTestId('err')).toHaveTextContent('new');
  });

  it('clears syncError when the connection drops and ignores in-flight results', async () => {
    open();
    await act(async () => h.pending[0]!.reject(new Error('boom')));
    expect(screen.getByTestId('err')).toHaveTextContent('boom');
    act(() => h.listeners.state?.({ status: 'reconnecting', attempt: 1, delayMs: 1000 }));
    expect(screen.getByTestId('err')).toHaveTextContent('none');
    open();
    act(() => h.listeners.state?.({ status: 'reconnecting', attempt: 1, delayMs: 1000 }));
    await act(async () => h.pending[1]!.reject(new Error('late')));
    expect(screen.getByTestId('err')).toHaveTextContent('none');
  });
});
