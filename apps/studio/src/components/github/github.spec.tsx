import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { GithubStatus, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { githubOfUnit, openUnitsOf } from '@/lib/open-units';
import { BridgeFailure, fakeClient } from '@/lib/wizard/__tests__/fake-client';
import { bridgeValue } from '../shell/shell-test-utils';
import { BridgeContext } from '../BridgeProvider';
import { OpenUnitsList } from '../OpenUnitsList';
import { StudioHeader } from '../StudioHeader';
import { GithubConnectPanel } from './GithubConnectPanel';

const status = (over: Partial<GithubStatus> = {}): GithubStatus => ({
  gh: { installed: true, authenticated: true, user: 'octo' },
  git: { repo: true, branch: 'main', hasCommits: true },
  remote: null,
  workflow: true,
  ...over,
});

const snapshot = (github?: WorkspaceSnapshot['github']): WorkspaceSnapshot =>
  ({
    project: 'my-proj', profile: 'solo', kitVersion: null, gateMode: 'block', pricing: null, stale: [], agents: [], skills: [], specs: [], fixes: [],
    cycles: [
      { specId: 'spec-a', cycle: 'cycle-01', status: 'in-progress', flow: 'lite', apps: [], tasks: [], tasksTotal: 3, tasksDone: 1 },
      { specId: 'spec-b', cycle: 'cycle-02', status: 'in-progress', flow: 'lite', apps: [], tasks: [], tasksTotal: 3, tasksDone: 1 },
    ],
    ...(github === undefined ? {} : { github }),
  }) as unknown as WorkspaceSnapshot;

const githubData: NonNullable<WorkspaceSnapshot['github']> = {
  remote: { url: 'https://github.com/o/r', owner: 'o', name: 'r' },
  cycles: [{ specId: 'spec-a', cycle: 'cycle-01', branch: 'feat/a-cycle-01', pr: { number: 12, url: 'https://github.com/o/r/pull/12', state: 'OPEN', isDraft: true }, checks: 'failure' }],
};

function mount(ui: React.ReactElement, fake: ReturnType<typeof fakeClient>, snap: WorkspaceSnapshot | null = snapshot()) {
  const value = bridgeValue({ client: fake.client as never }, snap);
  return render(
    <I18nProvider initial="en">
      <BridgeContext.Provider value={value}>{ui}</BridgeContext.Provider>
    </I18nProvider>,
  );
}

const withStatus = (s: GithubStatus, extra: (cmd: Record<string, unknown>) => unknown = () => null, features = ['github']) =>
  fakeClient((cmd) => (cmd.cmd === 'github.status' ? s : extra(cmd)), 'open', features);

afterEach(cleanup);

describe('GithubConnectPanel', () => {
  it('explains how to install gh when it is missing', async () => {
    mount(<GithubConnectPanel />, withStatus(status({ gh: { installed: false, authenticated: false, user: null } })));
    expect(await screen.findByTestId('github-gh-missing')).toHaveTextContent('brew install gh');
  });

  it('asks to run gh auth login when not authenticated', async () => {
    mount(<GithubConnectPanel />, withStatus(status({ gh: { installed: true, authenticated: false, user: null } })));
    expect(await screen.findByTestId('github-gh-auth')).toHaveTextContent('gh auth login');
  });

  it('shows the repository link when already connected', async () => {
    const fake = withStatus(status({ remote: { url: 'u', owner: 'o', name: 'r' } }));
    mount(<GithubConnectPanel generationId="g1" />, fake);
    const link = await screen.findByTestId('github-repo-link');
    expect(link).toHaveAttribute('href', 'https://github.com/o/r');
    expect(link).toHaveTextContent('o/r');
    expect(fake.requests[0]).toEqual({ cmd: 'github.status', generationId: 'g1' });
  });

  it('sends connect with protect off and private by default, then shows the link', async () => {
    const fake = withStatus(status(), (cmd) =>
      cmd.cmd === 'github.connect' ? { ok: true, remote: { url: 'u', owner: 'octo', name: 'my-proj' }, protected: false, error: null } : null,
    );
    const onConnected = vi.fn();
    mount(<GithubConnectPanel defaultName="my-proj" onConnected={onConnected} />, fake);
    const name = await screen.findByTestId('github-name');
    expect(name).toHaveValue('my-proj');
    expect(screen.getByTestId('github-owner')).toHaveAttribute('placeholder', 'octo');
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByTestId('github-done')).toHaveTextContent('octo/my-proj');
    expect(fake.requests.at(-1)).toEqual({ cmd: 'github.connect', name: 'my-proj', visibility: 'private', protect: false });
    expect(onConnected).toHaveBeenCalledWith({ url: 'u', owner: 'octo', name: 'my-proj' });
  });

  it('sends owner and protect when the user fills them in', async () => {
    const fake = withStatus(status(), () => ({ ok: true, remote: { url: 'u', owner: 'acme', name: 'x' }, protected: true, error: null }));
    mount(<GithubConnectPanel generationId="g2" defaultName="x" />, fake);
    fireEvent.change(await screen.findByTestId('github-owner'), { target: { value: 'acme' } });
    fireEvent.click(screen.getByLabelText(/Protect the default branch/));
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await screen.findByTestId('github-done');
    expect(fake.requests.at(-1)).toEqual({ cmd: 'github.connect', generationId: 'g2', name: 'x', owner: 'acme', visibility: 'private', protect: true });
  });

  it('blocks an invalid name and shows the error text returned by the bridge', async () => {
    const fake = withStatus(status(), () => ({ ok: false, remote: null, protected: false, error: 'name already exists' }));
    mount(<GithubConnectPanel defaultName="bad name" />, fake);
    const submit = await screen.findByRole('button', { name: 'Connect' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByTestId('github-name'), { target: { value: 'good-name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByTestId('github-error')).toHaveTextContent('name already exists');
  });

  it('shows a request failure and calls onSkip', async () => {
    const fake = withStatus(status(), () => {
      throw new BridgeFailure('internal', 'boom');
    });
    const onSkip = vi.fn();
    mount(<GithubConnectPanel defaultName="ok" onSkip={onSkip} />, fake);
    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(screen.getByTestId('github-error')).toHaveTextContent('boom'));
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onSkip).toHaveBeenCalled();
  });
});

describe('GitHub header indicator', () => {
  it('shows owner/name linking to the repo when the snapshot has the remote', () => {
    mount(<StudioHeader />, withStatus(status()), snapshot(githubData));
    const link = screen.getByTestId('github-header-link');
    expect(link).toHaveTextContent('o/r');
    expect(link).toHaveAttribute('href', 'https://github.com/o/r');
  });

  it('shows the connect button and opens the dialog when there is no remote', async () => {
    mount(<StudioHeader />, withStatus(status()), snapshot({ remote: null, cycles: [] }));
    fireEvent.click(screen.getByTestId('github-header-connect'));
    expect(await screen.findByTestId('github-form')).toBeInTheDocument();
  });

  it('falls back to github.status when the snapshot carries no github', async () => {
    const fake = withStatus(status({ remote: { url: 'u', owner: 'o', name: 'fallback' } }));
    mount(<StudioHeader />, fake, snapshot());
    expect(await screen.findByTestId('github-header-link')).toHaveTextContent('o/fallback');
    expect(fake.requests[0]).toEqual({ cmd: 'github.status' });
  });

  it('renders nothing without the github feature', () => {
    const fake = withStatus(status(), () => null, []);
    mount(<StudioHeader />, fake, snapshot(githubData));
    expect(screen.queryByTestId('github-header-link')).toBeNull();
    expect(screen.queryByTestId('github-header-connect')).toBeNull();
    expect(fake.requests).toEqual([]);
  });
});

describe('OpenUnitsList GitHub line', () => {
  it('shows PR number, state, draft and CI for a matching cycle, and the branch for one without PR', () => {
    const snap = snapshot({ ...githubData, cycles: [...githubData.cycles, { specId: 'spec-b', cycle: 'cycle-02', branch: 'feat/b-cycle-02', pr: null, checks: 'none' }] });
    mount(<OpenUnitsList units={openUnitsOf(snap)} />, withStatus(status()), snap);
    const [first, second] = screen.getAllByTestId('open-unit');
    expect(within(first!).getByTestId('unit-pr')).toHaveTextContent('PR #12');
    expect(within(first!).getByTestId('unit-pr')).toHaveAttribute('href', 'https://github.com/o/r/pull/12');
    expect(within(first!).getByTestId('unit-github')).toHaveTextContent('open · draft');
    expect(within(first!).getByTestId('unit-ci')).toHaveTextContent('CI failing');
    expect(within(second!).getByTestId('unit-branch')).toHaveTextContent('feat/b-cycle-02');
    expect(within(second!).queryByTestId('unit-ci')).toBeNull();
  });

  it('renders no GitHub line without snapshot.github', () => {
    const snap = snapshot();
    mount(<OpenUnitsList units={openUnitsOf(snap)} />, withStatus(status()), snap);
    expect(screen.queryAllByTestId('unit-github')).toEqual([]);
  });
});

describe('githubOfUnit', () => {
  it('matches by spec and cycle and ignores fixes', () => {
    const snap = snapshot(githubData);
    const [a, b] = openUnitsOf(snap);
    expect(githubOfUnit(snap, a!)?.branch).toBe('feat/a-cycle-01');
    expect(githubOfUnit(snap, b!)).toBeNull();
    expect(githubOfUnit(null, a!)).toBeNull();
    expect(githubOfUnit(snap, { kind: 'fix', key: 'F', fixId: 'F', label: 'F', title: '', severity: null })).toBeNull();
  });
});
