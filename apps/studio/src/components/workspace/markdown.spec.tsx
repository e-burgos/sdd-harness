import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { Markdown } from './Markdown';

describe('Markdown', () => {
  it('opens links safely and never loads images', () => {
    const { container } = render(<I18nProvider initial="es"><Markdown text={'[a](https://example.com) ![x](https://example.com/a.png)'} /></I18nProvider>);
    expect(container.querySelector('img')).toBeNull();
    const link = screen.getByRole('link', { name: 'a' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const img = screen.getByRole('link', { name: '[imagen: x]' });
    expect(img).toHaveAttribute('href', 'https://example.com/a.png');
    expect(img).toHaveAttribute('rel', 'noopener noreferrer');
  });
  it('translates the image label', () => {
    render(<I18nProvider initial="en"><Markdown text="![x](https://example.com/a.png)" /></I18nProvider>);
    expect(screen.getByRole('link', { name: '[image: x]' })).toBeInTheDocument();
  });
});
