import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ThemeModeScript } from '@e-burgos/tucu-ui/next';
import { StudioThemeProvider } from '@/components/StudioThemeProvider';

export const metadata: Metadata = {
  title: 'SDD Studio',
  description: 'Operations center for repos with the SDD kit',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="h-full" suppressHydrationWarning>
      <head>
        <ThemeModeScript defaultMode="system" />
      </head>
      <body className="h-full antialiased">
        <StudioThemeProvider>{children}</StudioThemeProvider>
      </body>
    </html>
  );
}
