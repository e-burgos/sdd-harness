import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { ConnectionBanner } from '../ConnectionBanner';

const renderBanner = (switching: { project: string; root: string; failed: boolean }) =>
  render(
    <I18nProvider initial="es">
      <ConnectionBanner connection={{ status: 'open' } as never} switching={switching} />
    </I18nProvider>,
  );

describe('ConnectionBanner switching typography', () => {
  it('uses the typographic scale while opening a project', () => {
    renderBanner({ project: 'acme', root: '/p/acme', failed: false });
    const banner = screen.getByRole('status');
    expect(banner).toHaveClass('text-ui');
    expect(banner).not.toHaveClass('text-xs');
  });

  it('uses the typographic scale when switching fails', () => {
    const { container } = renderBanner({ project: 'acme', root: '/p/acme', failed: true });
    expect(container.firstElementChild).toHaveClass('text-ui');
    expect(container.firstElementChild).not.toHaveClass('text-xs');
  });
});
