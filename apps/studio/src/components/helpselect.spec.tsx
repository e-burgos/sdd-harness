import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { HelpSelect } from './HelpSelect';

function mount(props: Partial<React.ComponentProps<typeof HelpSelect>> = {}) {
  return render(
    <I18nProvider>
      <label htmlFor="s">Modelo</label>
      <HelpSelect id="s" help="Explica el modelo" value="a" onChange={props.onChange ?? (() => undefined)} {...props}>
        <option value="a">A</option>
        <option value="b">B</option>
      </HelpSelect>
    </I18nProvider>,
  );
}

describe('HelpSelect', () => {
  it('keeps a native select reachable by its label', () => {
    mount();
    expect(screen.getByLabelText('Modelo')).toBeInstanceOf(HTMLSelectElement);
  });

  it('describes the select with the help text', () => {
    mount();
    expect(screen.getByLabelText('Modelo')).toHaveAccessibleDescription('Explica el modelo');
  });

  it('exposes the tooltip text and links the help icon to it', () => {
    mount();
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Explica el modelo');
    expect(screen.getByTestId('help-select-icon')).toHaveAttribute('aria-describedby', tooltip.id);
  });

  it('can be focused with the keyboard', () => {
    mount();
    const icon = screen.getByTestId('help-select-icon');
    icon.focus();
    expect(icon).toHaveFocus();
  });

  it('forwards value, change and disabled like a select', () => {
    const onChange = vi.fn();
    mount({ onChange, disabled: true });
    expect(screen.getByLabelText('Modelo')).toBeDisabled();
  });

  it('calls onChange with the chosen option', () => {
    const onChange = vi.fn();
    mount({ onChange });
    fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('merges an existing aria-describedby', () => {
    mount({ 'aria-describedby': 'extra' });
    expect(screen.getByLabelText('Modelo').getAttribute('aria-describedby')).toMatch(/^extra /);
  });
});
