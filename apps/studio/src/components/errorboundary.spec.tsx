import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('kaboom');
}

const renderBoundary = (props: Partial<React.ComponentProps<typeof ErrorBoundary>> = {}) =>
  render(
    <I18nProvider initial="es">
      <ErrorBoundary {...props}>
        <Boom />
      </ErrorBoundary>
    </I18nProvider>,
  );

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('replaces a crashed tree with a fallback that shows the error and reloads on demand', () => {
    const onReload = vi.fn();
    const onError = vi.fn();
    renderBoundary({ onReload, onError });
    expect(screen.getByRole('alert')).toHaveTextContent('Algo salió mal');
    expect(screen.getByRole('alert')).toHaveTextContent('kaboom');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'kaboom' }), expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Recargar' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('renders its children when nothing fails', () => {
    render(
      <I18nProvider initial="es">
        <ErrorBoundary><p>todo bien</p></ErrorBoundary>
      </I18nProvider>,
    );
    expect(screen.getByText('todo bien')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
