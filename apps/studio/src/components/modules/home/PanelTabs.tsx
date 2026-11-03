'use client';

import { PANEL_TYPE } from '@/lib/typography-tokens';

export interface PanelTab<Id extends string> {
  id: Id;
  label: string;
}

export function PanelTabs<Id extends string>({ tabs, active, onChange, label }: { tabs: PanelTab<Id>[]; active: Id; onChange(id: Id): void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 border-b border-foreground/10">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`${PANEL_TYPE.group} -mb-px h-7 rounded-t-md border-b-2 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
              selected ? 'border-accent-400 text-ink-50' : 'border-transparent hover:text-ink-100'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
