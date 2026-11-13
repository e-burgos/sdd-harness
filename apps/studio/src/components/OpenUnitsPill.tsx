'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { openUnitsOf } from '@/lib/open-units';
import { useStudio } from './BridgeProvider';
import { OpenUnitsList } from './OpenUnitsList';

export function OpenUnitsPill() {
  const { t } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const units = openUnitsOf(snapshot);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (units.length === 0) return null;
  return (
    <div ref={ref} className="relative hidden shrink-0 lg:block">
      <button
        type="button"
        data-testid="open-units-pill"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={t('units.pill.hint')}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-foreground/10 bg-foreground/5 px-2.5 py-1 font-mono text-meta text-ink-300 transition-colors hover:bg-foreground/10"
      >
        {t('units.pill', { n: units.length })}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t('units.popover')}
          data-testid="open-units-popover"
          className="absolute right-0 top-full z-50 mt-2 w-[360px] max-w-[calc(100vw-32px)] rounded-lg border border-foreground/10 bg-ink-900 p-3 shadow-xl"
        >
          <OpenUnitsList units={units} />
        </div>
      )}
    </div>
  );
}
