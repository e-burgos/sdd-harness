'use client';

import '@/lib/typography-tokens';
import { NextThemeProvider } from '@e-burgos/tucu-ui/next';
import type { ReactNode } from 'react';

export function StudioThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider layout="clean" defaultMode="system" menuItems={[]} showSettings={false} tooltipDefaults={{ lazy: true }}>
      {children}
    </NextThemeProvider>
  );
}
