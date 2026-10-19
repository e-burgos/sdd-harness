import { fireEvent, render, screen, within } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { ConnectScreen, SDD_DOCS_URL } from './ConnectScreen';

const wrap = (lang: 'es' | 'en' = 'es') => render(<I18nProvider initial={lang}><ConnectScreen /></I18nProvider>);

describe('ConnectScreen guide', () => {
  it('walks through the three steps with the install and bridge commands', () => {
    wrap();
    const steps = within(screen.getByRole('list', { name: 'Pasos para conectar tu repo' })).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent('Instalá el kit SDD en tu repo');
    expect(within(steps[0]!).getByText('npx @e-burgos/sdd-harness configure sdd')).toBeInTheDocument();
    expect(within(steps[0]!).getByText('npx @e-burgos/sdd-harness init')).toBeInTheDocument();
    expect(within(steps[1]!).getByText('npx @e-burgos/sdd-studio')).toBeInTheDocument();
    expect(steps[2]).toHaveTextContent('se abre esta web conectada a tu repo');
  });

  it('links to the SDD Harness install docs in a new tab', () => {
    wrap();
    const link = screen.getByRole('link', { name: /Cómo instalar SDD Harness/ });
    expect(link).toHaveAttribute('href', SDD_DOCS_URL);
    expect(SDD_DOCS_URL).toBe('https://sdd.estebanburgos.com.ar');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('lists the requirements', () => {
    wrap();
    const req = screen.getByRole('region', { name: 'Requisitos' });
    expect(req).toHaveTextContent('Node 20');
    expect(req).toHaveTextContent('claude login');
    expect(req).toHaveTextContent('Chrome');
    expect(req).toHaveTextContent('npx @e-burgos/sdd-studio --local-ui');
  });

  it('copies each command with its own button', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    wrap();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar: npx @e-burgos/sdd-harness configure sdd' }));
    await screen.findByRole('button', { name: 'Copiado: npx @e-burgos/sdd-harness configure sdd' });
    expect(writeText).toHaveBeenCalledWith('npx @e-burgos/sdd-harness configure sdd');
    expect(screen.getByRole('button', { name: 'Copiar: npx @e-burgos/sdd-studio' })).toBeInTheDocument();
  });

  it('is translated to English', () => {
    wrap('en');
    expect(screen.getByRole('list', { name: 'Steps to connect your repo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /How to install SDD Harness/ })).toBeInTheDocument();
  });
});
