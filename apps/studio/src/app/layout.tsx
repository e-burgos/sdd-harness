import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'SDD Studio',
  description: 'Operations center for repos with the SDD kit',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
