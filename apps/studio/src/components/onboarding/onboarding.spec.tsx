import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { WorkspaceSnapshot } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { NavProvider, useNav } from '@/lib/nav/use-nav';
import { hiddenGuideKey } from '@/lib/onboarding';
import { createStudioStore } from '@/lib/store/store';
import { fakeClient } from '@/lib/wizard/__tests__/fake-client';
import { bridgeValue, shellSnapshot } from '../shell/shell-test-utils';
import { BridgeContext } from '../BridgeProvider';
import { LauncherShell } from '../shell/LauncherShell';
import { FirstStepsCard } from './FirstStepsCard';
import { OnboardingSteps } from './OnboardingSteps';

const account = (state: string) => ({ state, email: null, method: null, plan: null, loginUrl: null, error: null });

const ghStatus = {
  gh: { installed: true, authenticated: true, user: 'octo' },
  git: { repo: true, branch: 'main', hasCommits: true },
  remote: null,
  workflow: true,
};

function Probe() {
  const module = useNav((s) => s.module);
  return <span data-testid="module">{module}</span>;
}

function mount(ui: React.ReactElement, fake: ReturnType<typeof fakeClient>, snap: WorkspaceSnapshot | null = null, extra: object = {}) {
  const value = bridgeValue({ client: fake.client as never, connection: { status: 'open', welcome: { workspace: { root: '/proj', project: 'p' } } } as never, ...extra }, snap);
  return render(
    <I18nProvider initial="en">
      <BridgeContext.Provider value={value}>
        <NavProvider project="p">
          {ui}
          <Probe />
        </NavProvider>
      </BridgeContext.Provider>
    </I18nProvider>,
  );
}

const snapshot = (over: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot => ({ ...shellSnapshot, specs: [], project: 'my-proj', ...over });

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('OnboardingSteps', () => {
  it('renders an accessible list with status per step', () => {
    render(
      <I18nProvider initial="en">
        <OnboardingSteps steps={[{ id: 'claude', status: 'done' }, { id: 'project', status: 'current' }, { id: 'github', status: 'unavailable' }, { id: 'first-work', status: 'pending' }]} />
      </I18nProvider>,
    );
    const list = screen.getByRole('list', { name: 'Steps to get started' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('data-status'))).toEqual(['done', 'current', 'unavailable', 'pending']);
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[2]).toHaveTextContent('unavailable');
  });
});

describe('LauncherShell onboarding strip', () => {
  it('shows the steps and the hint, with Claude as the current step', async () => {
    const fake = fakeClient((cmd) => (cmd.cmd === 'auth.status' ? account('disconnected') : null), 'open', ['github']);
    mount(<LauncherShell />, fake);
    const strip = screen.getByTestId('launcher-onboarding');
    expect(within(strip).getByText('Getting started')).toBeInTheDocument();
    await waitFor(() => expect(strip.querySelector('[data-step="claude"]')).toHaveAttribute('data-status', 'current'));
    expect(strip.querySelector('[data-step="project"]')).toHaveAttribute('data-status', 'pending');
    expect(strip).toHaveTextContent('Create a project with the wizard');
  });

  it('opens the account dialog from Connect Claude', async () => {
    const fake = fakeClient((cmd) => (cmd.cmd === 'auth.status' ? account('disconnected') : null), 'open', []);
    mount(<LauncherShell />, fake);
    fireEvent.click(screen.getByRole('button', { name: 'Connect Claude' }));
    expect(await screen.findByRole('tabpanel')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('marks Claude done and drops the button when the account is connected', async () => {
    const fake = fakeClient((cmd) => (cmd.cmd === 'auth.status' ? account('connected') : null), 'open', []);
    mount(<LauncherShell />, fake);
    const strip = screen.getByTestId('launcher-onboarding');
    await waitFor(() => expect(strip.querySelector('[data-step="claude"]')).toHaveAttribute('data-status', 'done'));
    expect(screen.queryByRole('button', { name: 'Connect Claude' })).toBeNull();
  });

  it('treats api-key auth as connected', () => {
    const fake = fakeClient(() => null, 'open', []);
    mount(<LauncherShell />, fake, null, { authMode: 'api-key' });
    expect(screen.getByTestId('launcher-onboarding').querySelector('[data-step="claude"]')).toHaveAttribute('data-status', 'done');
  });
});

describe('FirstStepsCard', () => {
  const github = () => fakeClient((cmd) => (cmd.cmd === 'github.status' ? ghStatus : null), 'open', ['github']);

  it('lists pending steps with their actions', () => {
    mount(<FirstStepsCard />, github(), snapshot());
    const card = screen.getByTestId('first-steps-card');
    expect(Array.from(card.querySelectorAll('li')).map((li) => [li.getAttribute('data-step'), li.getAttribute('data-done')])).toEqual([
      ['github', 'false'],
      ['idea', 'false'],
      ['spec', 'false'],
    ]);
  });

  it('marks done steps and omits GitHub without the feature', () => {
    mount(<FirstStepsCard />, fakeClient(() => null, 'open', []), snapshot({ specs: shellSnapshot.specs }));
    const card = screen.getByTestId('first-steps-card');
    expect(card.querySelector('[data-step="github"]')).toBeNull();
    expect(card.querySelector('[data-step="spec"]')).toHaveAttribute('data-done', 'true');
    expect(within(card.querySelector('[data-step="spec"]') as HTMLElement).queryByRole('button')).toBeNull();
  });

  it('marks GitHub done from the snapshot remote', () => {
    mount(<FirstStepsCard />, github(), snapshot({ github: { remote: { url: 'u', owner: 'o', name: 'r' }, cycles: [] } }));
    expect(screen.getByTestId('first-steps-card').querySelector('[data-step="github"]')).toHaveAttribute('data-done', 'true');
  });

  it('opens the GitHub dialog with the project name', async () => {
    mount(<FirstStepsCard />, github(), snapshot());
    fireEvent.click(within(screen.getByTestId('first-steps-card').querySelector('[data-step="github"]') as HTMLElement).getByRole('button'));
    expect(await screen.findByTestId('github-name')).toHaveValue('my-proj');
  });

  it('goes to the Specs module', () => {
    mount(<FirstStepsCard />, github(), snapshot());
    fireEvent.click(within(screen.getByTestId('first-steps-card').querySelector('[data-step="spec"]') as HTMLElement).getByRole('button', { name: 'Go to Specs' }));
    expect(screen.getByTestId('module')).toHaveTextContent('specs');
  });

  it('goes to the general channel from the idea action', () => {
    mount(<FirstStepsCard />, github(), snapshot());
    fireEvent.click(within(screen.getByTestId('first-steps-card').querySelector('[data-step="idea"]') as HTMLElement).getByRole('button'));
    expect(screen.getByTestId('module')).toHaveTextContent('home');
  });

  it('hides per project root and remembers it', () => {
    const view = mount(<FirstStepsCard />, github(), snapshot());
    fireEvent.click(screen.getByTestId('first-steps-hide'));
    expect(screen.queryByTestId('first-steps-card')).toBeNull();
    expect(window.localStorage.getItem(hiddenGuideKey('/proj'))).toBe('1');
    view.unmount();
    mount(<FirstStepsCard />, github(), snapshot());
    expect(screen.queryByTestId('first-steps-card')).toBeNull();
  });

  it('respects the hidden guide once the project root arrives after the first render', () => {
    window.localStorage.setItem(hiddenGuideKey('/proj'), '1');
    const fake = github();
    const tree = (connection: object) => (
      <I18nProvider initial="en">
        <BridgeContext.Provider value={bridgeValue({ client: fake.client as never, connection: connection as never }, snapshot())}>
          <NavProvider project="p">
            <FirstStepsCard />
          </NavProvider>
        </BridgeContext.Provider>
      </I18nProvider>
    );
    const view = render(tree({ status: 'connecting' }));
    view.rerender(tree({ status: 'open', welcome: { workspace: { root: '/proj', project: 'p' } } }));
    expect(screen.queryByTestId('first-steps-card')).toBeNull();
  });

  it('still shows when storage fails', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    mount(<FirstStepsCard />, github(), snapshot());
    expect(screen.getByTestId('first-steps-card')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('disappears when every step is done', () => {
    const snap = snapshot({ specs: shellSnapshot.specs, github: { remote: { url: 'u', owner: 'o', name: 'r' }, cycles: [] } });
    const store = createStudioStore();
    store.getState().setSnapshot(snap);
    store.getState().setThreads([{ id: 't1', channelId: 'general', title: 't', agent: 'sdd-hermes', status: 'idle', createdAt: '', lastActivity: '', link: { kind: 'none' }, pendingCount: 0 } as never]);
    mount(<FirstStepsCard />, github(), snap, { store });
    expect(screen.queryByTestId('first-steps-card')).toBeNull();
  });
});
