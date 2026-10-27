'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export function RailPopover({ open, label, onClose, className = '', exempt = false, children }: { open: boolean; label: string; onClose(): void; className?: string; exempt?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const root = ref.current?.parentElement;
      if (root && !root.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      data-studio-exempt={exempt ? 'hosted-component' : undefined}
      className={`absolute bottom-0 left-full z-50 ml-2 w-[300px] max-w-[calc(100vw-96px)] rounded-lg border border-foreground/10 bg-ink-900 p-3 shadow-xl ${className}`}
    >
      {children}
    </div>
  );
}
