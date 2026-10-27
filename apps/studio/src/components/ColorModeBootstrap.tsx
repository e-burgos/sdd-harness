'use client';

import { useTheme } from '@e-burgos/tucu-ui';
import { useEffect } from 'react';

export function ColorModeBootstrap() {
  useEffect(() => {
    const html = document.documentElement;
    const initial = html.dataset.studioInitialMode;
    if (initial !== 'dark' && initial !== 'light') return;
    delete html.dataset.studioInitialMode;
    queueMicrotask(() => useTheme.getState().setMode(initial));
  }, []);
  return null;
}
