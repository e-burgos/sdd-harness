import type { JSX } from 'react';

declare module '@e-burgos/tucu-ui/next' {
  export function ThemeModeScript(props: {
    nonce?: string;
    storageKey?: string;
    defaultMode?: 'light' | 'dark' | 'system';
    applyColorScheme?: boolean;
  }): JSX.Element;
}
