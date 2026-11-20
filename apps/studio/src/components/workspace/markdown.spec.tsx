import { render, screen, within } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { Markdown, splitFrontmatter } from './Markdown';

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

  it('renders tables with border classes in doc density', () => {
    const { container } = render(<I18nProvider initial="es"><Markdown density="doc" text={'| a | b |\n|---|---|\n| 1 | 2 |'} /></I18nProvider>);
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.firstElementChild?.className).toContain('[&_td]:border');
    expect(container.firstElementChild?.className).toContain('[&_table]:border-collapse');
  });

  it('shows the frontmatter card only in doc density', () => {
    const text = '---\nname: steward\n---\n# Body';
    const doc = render(<I18nProvider initial="es"><Markdown density="doc" text={text} /></I18nProvider>);
    expect(within(doc.getByTestId('markdown-frontmatter')).getByText('steward')).toBeInTheDocument();
    expect(doc.getByRole('heading', { name: 'Body' })).toBeInTheDocument();
    doc.unmount();
    const chat = render(<I18nProvider initial="es"><Markdown text={text} /></I18nProvider>);
    expect(chat.queryByTestId('markdown-frontmatter')).toBeNull();
  });
});

describe('splitFrontmatter', () => {
  it('returns no meta without a leading block', () => {
    expect(splitFrontmatter('# Title\n---\nx: y\n---')).toEqual({ meta: null, body: '# Title\n---\nx: y\n---' });
  });
  it('extracts pairs and keeps colons inside values', () => {
    const { meta, body } = splitFrontmatter('---\nname: sdd-steward\ndescription: Use when: asked\n---\n# Hi');
    expect(meta).toEqual([['name', 'sdd-steward'], ['description', 'Use when: asked']]);
    expect(body).toBe('# Hi');
  });
  it('folds continuation lines into the previous value', () => {
    const { meta } = splitFrontmatter('---\ntags:\n  - a\n  - b\n---\nbody');
    expect(meta).toEqual([['tags', '- a - b']]);
  });
});
