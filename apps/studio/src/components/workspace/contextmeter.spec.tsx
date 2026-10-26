import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { ContextMeter } from './ContextMeter';

const wrap = (ui: React.ReactNode) => render(<I18nProvider initial="es">{ui}</I18nProvider>);

describe('ContextMeter', () => {
  it('says there is no data instead of inventing a number', () => {
    wrap(<ContextMeter usage={null} onNewConversation={vi.fn()} />);
    expect(screen.getByText('Contexto: sin dato')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByTestId('context-meter')).toHaveAttribute('data-level', 'none');
  });

  it('shows used and limit with a progress bar and no warning while there is room', () => {
    wrap(<ContextMeter usage={{ usedTokens: 50_000, maxTokens: 200_000 }} onNewConversation={vi.fn()} />);
    expect(screen.getByTestId('context-meter-text')).toHaveTextContent('25% · 50.0k / 200.0k tokens');
    expect(screen.getByRole('progressbar', { name: 'Contexto de la sesión' })).toHaveAttribute('aria-valuenow', '25');
    expect(screen.queryByTestId('context-meter-warning')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nueva conversación' })).toBeNull();
  });

  it('warns at the threshold and offers a new conversation', () => {
    const onNewConversation = vi.fn();
    wrap(<ContextMeter usage={{ usedTokens: 150_000, maxTokens: 200_000 }} onNewConversation={onNewConversation} />);
    expect(screen.getByTestId('context-meter')).toHaveAttribute('data-level', 'warn');
    expect(screen.getByTestId('context-meter-warning')).toHaveTextContent('Queda 25% de contexto');
    fireEvent.click(screen.getByRole('button', { name: 'Nueva conversación' }));
    expect(onNewConversation).toHaveBeenCalledTimes(1);
  });

  it('turns critical close to the limit', () => {
    wrap(<ContextMeter usage={{ usedTokens: 190_000, maxTokens: 200_000 }} onNewConversation={vi.fn()} />);
    expect(screen.getByTestId('context-meter')).toHaveAttribute('data-level', 'critical');
    expect(screen.getByTestId('context-meter-warning')).toHaveTextContent('Queda solo 5% de contexto');
  });

  it('warns without the button when no handler is given', () => {
    wrap(<ContextMeter usage={{ usedTokens: 150_000, maxTokens: 200_000 }} />);
    expect(screen.getByTestId('context-meter-warning')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
