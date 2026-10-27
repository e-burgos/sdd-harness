'use client';

import '@/lib/typography-tokens';
import { NextThemeProvider } from '@e-burgos/tucu-ui/next';
import type { ReactNode } from 'react';

function systemMode(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function StudioThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider layout="clean" defaultMode={systemMode()} menuItems={[]} showSettings={false}>
      {children}
    </NextThemeProvider>
  );
}
