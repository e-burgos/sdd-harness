import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { StudioThemeProvider } from '@/components/StudioThemeProvider';

const INITIAL_MODE_SCRIPT = `(function(){try{var raw=localStorage.getItem('theme-storage'),mode=null;if(raw){mode=(JSON.parse(raw).state||{}).mode||null}var html=document.documentElement;if(mode!=='dark'&&mode!=='light'){mode=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}html.classList.toggle('dark',mode==='dark');html.classList.toggle('light',mode!=='dark')}catch(e){}})();`;

export const metadata: Metadata = {
  title: 'SDD Studio',
  description: 'Operations center for repos with the SDD kit',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INITIAL_MODE_SCRIPT }} />
      </head>
      <body className="h-full antialiased">
        <StudioThemeProvider>{children}</StudioThemeProvider>
      </body>
    </html>
  );
}
