'use client';

import { useEffect, type ReactNode } from 'react';

export const DOCUMENT_LOCK_ATTRIBUTE = 'data-app-shell';

export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(DOCUMENT_LOCK_ATTRIBUTE, '');
    return () => root.removeAttribute(DOCUMENT_LOCK_ATTRIBUTE);
  }, []);
  return (
    <div data-testid="app-shell" className="fixed inset-0 flex flex-col overflow-hidden">
      {children}
    </div>
  );
}
