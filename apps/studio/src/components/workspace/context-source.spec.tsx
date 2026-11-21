import { render, screen } from '@testing-library/react';
import type { ThreadContextSource } from '@sdd-studio/protocol';
import { I18nProvider } from '@/lib/i18n/i18n';
import { ContextSourceChip } from './ContextSourceChip';

const show = (source: ThreadContextSource | undefined, lang: 'es' | 'en' = 'es') =>
  render(
    <I18nProvider initial={lang}>
      <ContextSourceChip source={source} />
    </I18nProvider>,
  );

describe('ContextSourceChip', () => {
  it('shows the pack with unit, role and size and explains it', () => {
    show({ kind: 'pack', spec: 'spec-x', cycle: 'cycle-01', role: 'implementor-back', unit: 'B-02', bytes: 18_800 });
    const chip = screen.getByTestId('context-source');
    expect(chip).toHaveAttribute('data-kind', 'pack');
    expect(chip).toHaveTextContent('paquete · B-02 · implementor-back · 18,4 KB');
    expect(chip.getAttribute('title')).toMatch(/Paquete del kit/);
  });

  it('falls back to the cycle when the pack has no unit', () => {
    show({ kind: 'pack', spec: 'spec-x', cycle: 'cycle-01', role: 'planner', unit: null, bytes: 2048 });
    expect(screen.getByTestId('context-source')).toHaveTextContent('paquete · cycle-01 · planner · 2,0 KB');
  });

  it('shows the base context', () => {
    show({ kind: 'base', bytes: 37_888 }, 'en');
    const chip = screen.getByTestId('context-source');
    expect(chip).toHaveTextContent('base context · 37.0 KB');
    expect(chip.getAttribute('title')).toMatch(/Full context/);
  });

  it('renders nothing without a source', () => {
    show(undefined);
    expect(screen.queryByTestId('context-source')).toBeNull();
  });
});
