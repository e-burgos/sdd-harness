import { render, screen } from '@testing-library/react';
import { Markdown } from './Markdown';

describe('Markdown', () => {
  it('opens links safely and never loads images', () => {
    const { container } = render(<Markdown text={'[a](https://example.com) ![x](https://example.com/a.png)'} />);
    expect(container.querySelector('img')).toBeNull();
    const link = screen.getByRole('link', { name: 'a' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const img = screen.getByRole('link', { name: '[imagen: x]' });
    expect(img).toHaveAttribute('href', 'https://example.com/a.png');
    expect(img).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
