'use client';

import { Button, Tooltip } from '@e-burgos/tucu-ui';
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
    <Tooltip size="xs" arrow={false} content={label} placement={side === 'right' ? 'left' : 'right'}>
      <Button type="button" variant="transparent" color="gray" shape="circle" size="mini" aria-label={label} onClick={onClick}>
        {side === 'right' ? <PanelRight size={16} /> : <PanelLeft size={16} />}
      </Button>
    </Tooltip>
  );
}
