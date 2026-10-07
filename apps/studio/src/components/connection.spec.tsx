import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { PAIRING_KEY } from '@/lib/bridge/pairing';
import type { ConnectionState } from '@/lib/bridge/client';
import { BridgeContext } from './BridgeProvider';
import { ConnectScreen } from './ConnectScreen';
import { ConnectionBanner } from './ConnectionBanner';
import { Connected } from './WorkspaceApp';

const wrap = (ui: React.ReactNode) => render(<I18nProvider initial="es">{ui}</I18nProvider>);

function renderConnected(connection: ConnectionState) {
  const value = { client: {}, store: {}, connection, pairing: { port: 4455, token: 'x'.repeat(20) } } as never;
  return render(
    <I18nProvider initial="es">
      <BridgeContext.Provider value={value}>
        <Connected />
      </BridgeContext.Provider>
    </I18nProvider>,
  );
}

describe('connection UI', () => {
  it('shows the bridge command and an error', () => {
    wrap(<ConnectScreen error="token inválido" />);
    expect(screen.getByText('npx @e-burgos/sdd-studio')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('token inválido');
  });
  it('shows reconnect countdown and hides when open', () => {
    const { rerender } = wrap(<ConnectionBanner connection={{ status: 'reconnecting', attempt: 2, delayMs: 2000 }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Reconectando en 2s');
    rerender(<I18nProvider initial="es"><ConnectionBanner connection={{ status: 'idle' }} /></I18nProvider>);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('maps unreachable with the port and keeps the pairing', () => {
    sessionStorage.setItem(PAIRING_KEY, 'keep');
    renderConnected({ status: 'failed', reason: 'unreachable', message: 'm' });
    expect(screen.getByRole('alert')).toHaveTextContent('puerto 4455');
    expect(sessionStorage.getItem(PAIRING_KEY)).toBe('keep');
  });
  it.each([
    ['bad-token', 'token no es válido'],
    ['bad-message', 'rechazó el mensaje'],
  ] as const)('maps %s and clears the stale pairing', (reason, text) => {
    sessionStorage.setItem(PAIRING_KEY, 'stale');
    renderConnected({ status: 'failed', reason, message: 'm' });
    expect(screen.getByRole('alert')).toHaveTextContent(text);
    expect(sessionStorage.getItem(PAIRING_KEY)).toBeNull();
  });
  it('maps protocol-mismatch without clearing the pairing', () => {
    sessionStorage.setItem(PAIRING_KEY, 'keep');
    renderConnected({ status: 'failed', reason: 'protocol-mismatch', message: 'm' });
    expect(screen.getByRole('alert')).toHaveTextContent('no es compatible');
    expect(sessionStorage.getItem(PAIRING_KEY)).toBe('keep');
  });
});
