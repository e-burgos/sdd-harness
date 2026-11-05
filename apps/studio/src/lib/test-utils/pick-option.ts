import { fireEvent, screen } from '@testing-library/react';

const TUCU_SELECT_CLOSE_MS = 100;

export const waitForSelectToClose = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, TUCU_SELECT_CLOSE_MS + 20));

const nameOf = (option: HTMLElement): string => option.querySelector(':scope > div > span')?.textContent ?? option.textContent ?? '';

export function openSelect(combobox: HTMLElement): void {
  fireEvent.click(combobox);
}

export function pickOption(combobox: HTMLElement, optionName: string | RegExp): void {
  openSelect(combobox);
  const option = screen.getAllByRole('option').find((o) => (typeof optionName === 'string' ? nameOf(o) === optionName : optionName.test(nameOf(o))));
  if (!option) throw new Error(`No option named ${String(optionName)}`);
  fireEvent.click(option);
}

export function optionNames(combobox: HTMLElement): string[] {
  openSelect(combobox);
  const names = screen.getAllByRole('option').map(nameOf);
  fireEvent.keyDown(combobox, { key: 'Escape' });
  return names;
}
