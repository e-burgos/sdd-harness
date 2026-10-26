'use client';

import { PanelLeft, PanelRight } from 'lucide-react';

export function PanelRail({ side, label, onExpand }: { side: 'left' | 'right'; label: string; onExpand(): void }) {
  return (
    <div className={`flex h-full flex-col items-center bg-ink-900 py-3 ${side === 'left' ? 'border-r' : 'border-l'} border-ink-800`}>
      <PanelToggle label={label} side={side} onClick={onExpand} />
    </div>
  );
}

export function PanelToggle({ label, side, onClick }: { label: string; side: 'left' | 'right'; onClick(): void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
      onClick={onClick}
    >
      {side === 'right' ? <PanelRight size={16} /> : <PanelLeft size={16} />}
    </button>
  );
}
