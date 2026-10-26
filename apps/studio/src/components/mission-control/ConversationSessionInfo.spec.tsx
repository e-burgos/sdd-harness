import { render, screen } from '@testing-library/react';
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
    renderInfo({ engineSessionId: 'f3a9c1d2-0000', provider: 'claude' });
    expect(screen.getByTestId('conversation-session')).toHaveTextContent('f3a9c1d2-0000');
    expect(screen.getByTestId('conversation-provider')).toHaveTextContent('Claude Code');
  });

  it('shows that no session exists yet when the bridge reports null', () => {
    renderInfo({ engineSessionId: null, provider: 'claude' });
    expect(screen.getByTestId('conversation-session')).toHaveTextContent('Sin sesión todavía');
  });

  it('distinguishes a bridge that does not report session or provider', () => {
    renderInfo({ engineSessionId: undefined, provider: undefined });
    expect(screen.getByTestId('conversation-session')).toHaveTextContent('sesión no informada');
    expect(screen.getByTestId('conversation-provider')).toHaveTextContent('proveedor no informado');
  });

  it('shows an unknown provider as received', () => {
    renderInfo({ engineSessionId: 'abc', provider: 'mistral' });
    expect(screen.getByTestId('conversation-provider')).toHaveTextContent('mistral');
  });
});
