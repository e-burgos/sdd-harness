import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextThemeProvider } from '@e-burgos/tucu-ui/next';

export const metadata: Metadata = {
  title: 'SDD Studio',
  description: 'Operations center for repos with the SDD kit',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="h-full" suppressHydrationWarning>
      <body className="h-full antialiased">
        <NextThemeProvider themeStyle="default" layout="clean" mode="dark" background="none" menuItems={[]} showSettings={false}>
          {children}
        </NextThemeProvider>
      </body>
    </html>
  );
}
