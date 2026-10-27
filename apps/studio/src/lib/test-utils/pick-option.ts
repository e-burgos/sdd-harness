import { fireEvent, screen } from '@testing-library/react';

export function openSelect(combobox: HTMLElement): void {
  fireEvent.click(combobox);
}

export function pickOption(combobox: HTMLElement, optionName: string | RegExp): void {
  openSelect(combobox);
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

export function optionNames(combobox: HTMLElement): string[] {
  openSelect(combobox);
  const names = screen.getAllByRole('option').map((o) => o.textContent ?? '');
  fireEvent.keyDown(combobox, { key: 'Escape' });
  return names;
}
