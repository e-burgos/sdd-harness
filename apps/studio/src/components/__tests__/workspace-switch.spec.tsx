import { act, fireEvent, render, screen } from '@testing-library/react';
import { BridgeContext, BridgeProvider, SWITCH_TIMEOUT_MS, useBridge, useStudio } from '../BridgeProvider';
import { draftKey } from '@/lib/store/state';
import { I18nProvider } from '@/lib/i18n/i18n';
import { ConnectionBanner } from '../ConnectionBanner';
import { NavProvider, useNav } from '@/lib/nav/use-nav';
import { WorkspaceArrival } from '../WorkspaceApp';
import { bridgeValue } from '../shell/shell-test-utils';
import { savePendingIdea, loadPendingIdea, saveWizardState } from '@/lib/wizard/persist';
import { initialWizardState } from '@/lib/wizard/state';

const h = vi.hoisted(() => ({
  state: null as ((s: unknown) => void) | null,
  event: null as ((e: unknown) => void) | null,
  bootstrap: vi.fn(() => Promise.resolve()),
  close: vi.fn(),
  connect: vi.fn(),
}));

vi.mock('@/lib/bootstrap', () => ({ bootstrap: h.bootstrap }));
vi.mock('@/lib/bridge/client', () => ({
  BridgeError: class BridgeError extends Error {
    code = 'x';
  },
  BridgeClient: class {
    state = { status: 'idle' };
    onState(fn: (s: unknown) => void) {
      h.state = fn;
      return () => undefined;
    }
    onEvent(fn: (e: unknown) => void) {
      h.event = fn;
      return () => undefined;
    }
    connect = h.connect;
    close = h.close;
    request = vi.fn();
  },
}));

function Probe() {
  const { switching, workspaceMode, workspaceEpoch, retrySwitch } = useBridge();
  const draft = useStudio((s) => s.drafts[draftKey('general', null)]?.text ?? '');
  return (
    <>
      <p data-testid="mode">{workspaceMode ?? 'none'}</p>
      <p data-testid="epoch">{workspaceEpoch}</p>
      <p data-testid="switching">{switching ? `${switching.project}:${switching.failed}` : 'none'}</p>
      <p data-testid="draft">{draft}</p>
      <button onClick={retrySwitch}>retry</button>
    </>
  );
}

const welcome = (workspace: { root: string; project: string } | null) => ({ authMode: 'local', workspace, features: [] });
const open = (workspace: { root: string; project: string } | null) => act(() => h.state?.({ status: 'open', welcome: welcome(workspace) }));
const switched = (root: string, project: string) => act(() => h.event?.({ kind: 'workspace.switched', root, project }));

describe('BridgeProvider workspace switch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.bootstrap.mockClear();
    h.close.mockClear();
    h.connect.mockClear();
    window.sessionStorage.clear();
    render(
      <I18nProvider initial="es">
        <BridgeProvider pairing={{ port: 1, token: 'x'.repeat(20) }}>
          <Probe />
        </BridgeProvider>
      </I18nProvider>,
    );
  });
  afterEach(() => vi.useRealTimers());

  it('does not sync project data in launcher mode', () => {
    open(null);
    expect(screen.getByTestId('mode')).toHaveTextContent('launcher');
    expect(h.bootstrap).not.toHaveBeenCalled();
  });

  it('tracks the switching state and fails after the timeout', () => {
    open(null);
    switched('/w/nuevo', 'nuevo');
    expect(screen.getByTestId('switching')).toHaveTextContent('nuevo:false');
    act(() => void vi.advanceTimersByTime(SWITCH_TIMEOUT_MS - 1));
    expect(screen.getByTestId('switching')).toHaveTextContent('nuevo:false');
    act(() => void vi.advanceTimersByTime(2));
    expect(screen.getByTestId('switching')).toHaveTextContent('nuevo:true');
  });

  it('resets the store, hands the idea over as a draft and clears the wizard session when the root changes', () => {
    open({ root: '/w/a', project: 'a' });
    expect(h.bootstrap).toHaveBeenCalledTimes(1);
    savePendingIdea('Armá la primera spec');
    saveWizardState(initialWizardState());
    switched('/w/b', 'b');
    act(() => h.state?.({ status: 'reconnecting', attempt: 1, delayMs: 500 }));
    open({ root: '/w/b', project: 'b' });
    expect(screen.getByTestId('epoch')).toHaveTextContent('1');
    expect(screen.getByTestId('switching')).toHaveTextContent('none');
    expect(screen.getByTestId('draft')).toHaveTextContent('Armá la primera spec');
    expect(loadPendingIdea()).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
    expect(h.bootstrap).toHaveBeenCalledTimes(2);
  });

  it('keeps the epoch and the draft state when the same root reconnects', () => {
    open({ root: '/w/a', project: 'a' });
    open({ root: '/w/a', project: 'a' });
    expect(screen.getByTestId('epoch')).toHaveTextContent('0');
  });

  it('leaves launcher mode when the new welcome has a workspace', () => {
    open(null);
    savePendingIdea('idea');
    open({ root: '/w/b', project: 'b' });
    expect(screen.getByTestId('mode')).toHaveTextContent('project');
    expect(screen.getByTestId('epoch')).toHaveTextContent('1');
    expect(screen.getByTestId('draft')).toHaveTextContent('idea');
  });

  it('retries the connection and rearms the timeout', () => {
    open(null);
    switched('/w/b', 'b');
    act(() => void vi.advanceTimersByTime(SWITCH_TIMEOUT_MS + 1));
    expect(screen.getByTestId('switching')).toHaveTextContent('b:true');
    fireEvent.click(screen.getByText('retry'));
    expect(h.close).toHaveBeenCalled();
    expect(h.connect).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('switching')).toHaveTextContent('b:false');
    act(() => void vi.advanceTimersByTime(SWITCH_TIMEOUT_MS + 1));
    expect(screen.getByTestId('switching')).toHaveTextContent('b:true');
  });
});

describe('WorkspaceArrival', () => {
  function Module() {
    return <p data-testid="module">{useNav((s) => s.module)}</p>;
  }
  function Select() {
    const setModule = useNav((s) => s.setModule);
    return <button onClick={() => setModule('fixes')}>fixes</button>;
  }
  const tree = (epoch: number) => (
    <I18nProvider initial="es">
      <BridgeContext.Provider value={bridgeValue({ workspaceEpoch: epoch } as never)}>
        <NavProvider project="arrival-project">
          <WorkspaceArrival />
          <Module />
          <Select />
        </NavProvider>
      </BridgeContext.Provider>
    </I18nProvider>
  );

  beforeEach(() => window.localStorage.clear());

  it('goes to #general when the epoch advances and leaves navigation alone otherwise', () => {
    const view = render(tree(0));
    fireEvent.click(screen.getByText('fixes'));
    view.rerender(tree(0));
    expect(screen.getByTestId('module')).toHaveTextContent('fixes');
    view.rerender(tree(1));
    expect(screen.getByTestId('module')).toHaveTextContent('home');
  });
});

describe('ConnectionBanner switching', () => {
  const wrap = (ui: React.ReactNode) => render(<I18nProvider initial="es">{ui}</I18nProvider>);

  it('announces the project being opened', () => {
    wrap(<ConnectionBanner connection={{ status: 'reconnecting', attempt: 1, delayMs: 500 }} switching={{ project: 'nuevo', root: '/r', failed: false }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Abriendo nuevo…');
  });

  it('shows an actionable error with the root and a retry', () => {
    const retry = vi.fn();
    wrap(<ConnectionBanner connection={{ status: 'idle' }} switching={{ project: 'nuevo', root: '/home/dev/nuevo', failed: true }} onRetrySwitch={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo abrir nuevo. Abrilo a mano: corré npx @e-burgos/sdd-studio en /home/dev/nuevo.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar conexión' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
