import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AuthPreference } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { BridgeContext, type BridgeContextValue } from '../BridgeProvider';
import { AuthPanel } from './AuthPanel';

const account = (over: Record<string, unknown> = {}) => ({ state: 'disconnected', email: null, method: null, plan: null, loginUrl: null, error: null, ...over });

function setup(opts: { responses?: Record<string, unknown>; features?: string[]; authPreference?: AuthPreference | null } = {}) {
  const request = vi.fn(async (cmd: { cmd: string }) => (opts.responses ?? {})[cmd.cmd] ?? account());
  const setAuthPreference = vi.fn(async () => undefined);
  const value = {
    client: { request },
    connection: { status: 'open', welcome: { features: opts.features ?? ['auth-subscription'] } },
    authMode: 'local-claude-login',
    apiKeySource: null,
    setApiKey: vi.fn(),
    authPreference: opts.authPreference ?? null,
    setAuthPreference,
  } as unknown as BridgeContextValue;
  render(
    <I18nProvider>
      <BridgeContext.Provider value={value}>
        <AuthPanel />
      </BridgeContext.Provider>
    </I18nProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Conectar cuenta|Connect account/ }));
  return { request, setAuthPreference };
}

describe('AuthPanel', () => {
  it('renders an accessible tablist with Subscription selected by default', () => {
    setup();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(screen.getByRole('tabpanel')).toBeTruthy();
  });

  it('shows who is connected, with method and plan only when the CLI reports them', async () => {
    setup({ responses: { 'auth.status': account({ state: 'connected', email: 'dev@example.com', method: 'claude.ai' }) } });
    expect(await screen.findByText(/dev@example\.com · claude\.ai/)).toBeTruthy();
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it('connect triggers auth.login and shows the sign-in link while pending', async () => {
    const { request } = setup({ responses: { 'auth.login': account({ state: 'pending', loginUrl: 'https://claude.ai/oauth/authorize?x=1' }) } });
    fireEvent.click(await screen.findByRole('button', { name: /Conectar suscripción|Connect subscription/ }));
    const link = await screen.findByRole('link');
    expect(link.getAttribute('href')).toBe('https://claude.ai/oauth/authorize?x=1');
    expect(request).toHaveBeenCalledWith({ cmd: 'auth.login' });
  });

  it('asks for confirmation before disconnecting', async () => {
    const { request } = setup({ responses: { 'auth.status': account({ state: 'connected', email: 'a@b.co', method: 'claude.ai' }) } });
    fireEvent.click(await screen.findByRole('button', { name: /Desconectar|Disconnect/ }));
    expect(request).not.toHaveBeenCalledWith({ cmd: 'auth.logout' });
    fireEvent.click(screen.getByRole('button', { name: /^(Desconectar|Disconnect)$/ }));
    await waitFor(() => expect(request).toHaveBeenCalledWith({ cmd: 'auth.logout' }));
  });

  it('selecting the API key tab applies the preference and shows the key form', async () => {
    const { setAuthPreference } = setup();
    fireEvent.click(screen.getByRole('tab', { name: 'API key' }));
    expect(setAuthPreference).toHaveBeenCalledWith('api-key');
  });

  it('reports an error from the CLI', async () => {
    setup({ responses: { 'auth.status': account({ state: 'error', error: 'claude not found' }) } });
    expect((await screen.findByRole('alert')).textContent).toContain('claude not found');
  });

  it('explains when the bridge predates subscription connect', () => {
    setup({ features: [] });
    expect(screen.getByText(/anterior|predates/)).toBeTruthy();
  });
});
