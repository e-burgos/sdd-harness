import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { SegmentedControl, type SegmentSemantics } from './SegmentedControl';

const OPTIONS = [
  { id: 'a', label: 'Alfa' },
  { id: 'b', label: 'Beta', disabled: true },
  { id: 'c', label: 'Gamma' },
];

function Harness({ semantics, onChange }: { semantics: SegmentSemantics; onChange?: (id: string) => void }) {
  const [value, setValue] = useState('a');
  return (
    <SegmentedControl
      semantics={semantics}
      ariaLabel="Vista"
      idBase="x"
      value={value}
      options={OPTIONS}
      onChange={(id) => {
        setValue(id);
        onChange?.(id);
      }}
    />
  );
}

describe('SegmentedControl', () => {
  it('exposes tablist, tab and aria-selected with panel wiring', () => {
    render(<Harness semantics="tabs" />);
    expect(screen.getByRole('tablist', { name: 'Vista' })).toBeInTheDocument();
    const alfa = screen.getByRole('tab', { name: 'Alfa' });
    expect(alfa).toHaveAttribute('aria-selected', 'true');
    expect(alfa).toHaveAttribute('id', 'x-tab-a');
    expect(alfa).toHaveAttribute('aria-controls', 'x-panel-a');
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveAttribute('tabindex', '-1');
  });

  it('exposes radiogroup and aria-checked', () => {
    render(<Harness semantics="radio" />);
    expect(screen.getByRole('radiogroup', { name: 'Vista' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Alfa' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveAttribute('aria-checked', 'false');
  });

  it('keeps plain buttons inside a labelled navigation with aria-current', () => {
    render(<Harness semantics="nav" />);
    expect(screen.getByRole('navigation', { name: 'Vista' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alfa' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Gamma' })).not.toHaveAttribute('aria-current');
  });

  it('selects by click and ignores disabled segments', () => {
    const onChange = vi.fn();
    render(<Harness semantics="tabs" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Gamma' }));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('moves with the arrow keys skipping disabled segments, wrapping and focusing', () => {
    render(<Harness semantics="tabs" />);
    const alfa = screen.getByRole('tab', { name: 'Alfa' });
    alfa.focus();
    fireEvent.keyDown(alfa, { key: 'ArrowRight' });
    const gamma = screen.getByRole('tab', { name: 'Gamma' });
    expect(gamma).toHaveAttribute('aria-selected', 'true');
    expect(gamma).toHaveFocus();
    fireEvent.keyDown(gamma, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Alfa' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Alfa' }), { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveAttribute('aria-selected', 'true');
  });
});
