import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { ConversationSessionInfo } from './ConversationSessionInfo';

const renderInfo = (props: Parameters<typeof ConversationSessionInfo>[0]) =>
  render(
    <I18nProvider initial="es">
      <ConversationSessionInfo {...props} />
    </I18nProvider>,
  );

describe('ConversationSessionInfo', () => {
  it('shows the real session id and the known provider label', () => {
    renderInfo({ sessionTitle: null, engineSessionId: 'f3a9c1d2-0000', provider: 'claude' });
    expect(screen.getByTestId('conversation-session')).toHaveTextContent('f3a9c1d2-0000');
    expect(screen.getByTestId('conversation-provider')).toHaveTextContent('Claude Code');
  });

  it('shows that no session exists yet when the bridge reports null', () => {
    renderInfo({ sessionTitle: null, engineSessionId: null, provider: 'claude' });
    expect(screen.getByTestId('conversation-session')).toHaveTextContent('Sin sesión todavía');
  });

  it('warns that the bridge is out of date when session and provider are undefined, unlike the null no-session state', () => {
    const { unmount } = renderInfo({ sessionTitle: null, engineSessionId: undefined, provider: undefined });
    expect(screen.getByTestId('conversation-session')).toHaveTextContent('Bridge desactualizado — reiniciá el bridge');
    expect(screen.getByTestId('conversation-provider')).toHaveTextContent('Bridge desactualizado — reiniciá el bridge');
    expect(screen.queryByTestId('copy-session-button')).toBeNull();
    unmount();
    renderInfo({ sessionTitle: null, engineSessionId: null, provider: undefined });
    expect(screen.getByTestId('conversation-session')).not.toHaveTextContent('Bridge desactualizado');
    expect(screen.getByTestId('conversation-session')).toHaveTextContent('Sin sesión todavía');
  });

  it('shows the full session id and copies it', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const id = 'f3a9c1d2-7b1e-4c55-9a0e-1234567890ab';
    renderInfo({ sessionTitle: null, engineSessionId: id, provider: 'claude' });
    expect(screen.getByTestId('conversation-session').textContent).toBe(id);
    fireEvent.click(screen.getByTestId('copy-session-button'));
    expect(writeText).toHaveBeenCalledWith(id);
  });

  it('shows an unknown provider as received', () => {
    renderInfo({ sessionTitle: null, engineSessionId: 'abc', provider: 'mistral' });
    expect(screen.getByTestId('conversation-provider')).toHaveTextContent('mistral');
  });

  it('shows the three title states: title, no title available and out-of-date bridge', () => {
    const { unmount } = renderInfo({ sessionTitle: 'Revisar la spec 007', engineSessionId: null, provider: 'claude' });
    expect(screen.getByTestId('conversation-title')).toHaveTextContent('Revisar la spec 007');
    expect(screen.getByTestId('conversation-title')).toHaveClass('truncate');
    unmount();
    const second = renderInfo({ sessionTitle: null, engineSessionId: null, provider: 'claude' });
    expect(screen.getByTestId('conversation-title')).toHaveTextContent('Sin título disponible');
    second.unmount();
    renderInfo({ sessionTitle: undefined, engineSessionId: null, provider: 'claude' });
    expect(screen.getByTestId('conversation-title')).toHaveTextContent('Bridge desactualizado — reiniciá el bridge');
  });
});
