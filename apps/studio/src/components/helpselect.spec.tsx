import { fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18n';
import { optionNames, pickOption, waitForSelectToClose } from '@/lib/test-utils/pick-option';
import { HelpSelect } from './HelpSelect';

afterEach(waitForSelectToClose);

const OPTIONS = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C', disabled: true },
];

function mount(props: Partial<React.ComponentProps<typeof HelpSelect>> = {}) {
  return render(
    <I18nProvider>
      <HelpSelect label="Modelo" help="Explica el modelo" value="a" options={OPTIONS} onChange={() => undefined} {...props} />
    </I18nProvider>,
  );
}

describe('HelpSelect', () => {
  it('renders a combobox named by its label and showing the selected option', () => {
    mount();
    const combobox = screen.getByRole('combobox', { name: 'Modelo' });
    expect(combobox).toHaveTextContent('A');
    expect(screen.getByLabelText('Modelo')).toBe(combobox);
  });

  it('describes the combobox with the help text', () => {
    mount();
    expect(screen.getByLabelText('Modelo')).toHaveAccessibleDescription('Explica el modelo');
  });

  it('keeps the help out of the way until the icon is hovered or focused, then links it', () => {
    mount();
    const icon = screen.getByTestId('help-select-icon');
    expect(screen.queryByRole('tooltip')).toBeNull();
    icon.focus();
    expect(icon).toHaveFocus();
    fireEvent.focus(icon);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Explica el modelo');
    expect(icon).toHaveAttribute('aria-describedby', tooltip.id);
    expect(icon).toHaveAccessibleDescription('Explica el modelo');
  });

  it('lists every option and honors disabled ones', () => {
    mount();
    const combobox = screen.getByLabelText('Modelo');
    expect(optionNames(combobox)).toEqual(['A', 'B', 'C']);
    fireEvent.click(combobox);
    expect(screen.getByRole('option', { name: 'C' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables the combobox like a select', () => {
    mount({ disabled: true });
    expect(screen.getByLabelText('Modelo')).toBeDisabled();
  });

  it('calls onChange with the chosen value and ignores re-picking the current one', async () => {
    const onChange = vi.fn();
    mount({ onChange });
    const combobox = screen.getByRole('combobox', { name: 'Modelo' });
    pickOption(combobox, 'A');
    expect(onChange).not.toHaveBeenCalled();
    await waitForSelectToClose();
    pickOption(combobox, 'B');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('opens and picks with the keyboard', () => {
    const onChange = vi.fn();
    mount({ onChange });
    const combobox = screen.getByLabelText('Modelo');
    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    fireEvent.keyDown(combobox, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
