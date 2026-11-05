import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { BridgeFailure, fakeClient } from '@/lib/wizard/__tests__/fake-client';
import { catalogResultFixture } from '@/lib/wizard/__tests__/fixtures';
import { BridgeContext } from '../BridgeProvider';
import { bridgeValue } from '../shell/shell-test-utils';
import { Connected } from '../WorkspaceApp';

const launcherWelcome = { authMode: 'local', workspace: null, features: ['project-wizard', 'workspace-switch'] };

function mount(overrides: Record<string, unknown>, withSnapshot = false) {
  const fake = fakeClient((cmd) => {
    if (cmd.cmd === 'wizard.catalog') return catalogResultFixture;
    throw new BridgeFailure('not-found', String(cmd.cmd));
  });
  const value = bridgeValue({ client: fake.client as never, ...overrides } as never, withSnapshot ? undefined : null);
  render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <Connected />
      </BridgeContext.Provider>
    </I18nProvider>,
  );
  return fake;
}

describe('LauncherShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('replaces StudioShell when the welcome has no workspace', async () => {
    mount({ connection: { status: 'open', welcome: launcherWelcome } });
    expect(screen.getByTestId('launcher-shell')).toBeInTheDocument();
    expect(screen.getAllByText('Sin proyecto abierto').length).toBeGreaterThan(0);
    expect(screen.queryByRole('navigation', { name: 'Módulos' })).toBeNull();
    expect(screen.queryByTestId('gate-chip')).toBeNull();
    expect(await screen.findByRole('radiogroup', { name: 'Alcance del proyecto' })).toBeInTheDocument();
  });

  it('keeps the launcher while reconnecting after a switch request', () => {
    mount({ connection: { status: 'reconnecting', attempt: 1, delayMs: 500 }, workspaceMode: 'launcher' });
    expect(screen.getByTestId('launcher-shell')).toBeInTheDocument();
  });

  it('shows the project shell when the welcome carries a workspace', () => {
    mount({ connection: { status: 'open', welcome: { authMode: 'local', workspace: { root: '/p', project: 'p' } } } }, true);
    expect(screen.queryByTestId('launcher-shell')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Módulos' })).toBeInTheDocument();
  });

  it('announces the project being opened over the launcher', () => {
    mount({
      connection: { status: 'reconnecting', attempt: 1, delayMs: 500 },
      workspaceMode: 'launcher',
      switching: { project: 'nuevo', root: '/home/dev/nuevo', failed: false },
    });
    expect(screen.getByText('Abriendo nuevo…')).toBeInTheDocument();
  });
});
