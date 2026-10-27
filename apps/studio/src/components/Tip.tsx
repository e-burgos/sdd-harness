'use client';

import { Tooltip, type TooltipPlacement } from '@e-burgos/tucu-ui';
import type { ReactElement, ReactNode } from 'react';

const surface = 'max-w-64 bg-ink-100! px-2 py-1 text-left text-ink-950!';

export const tipContent = (text: ReactNode) => <span className="text-meta font-normal normal-case leading-snug">{text}</span>;

export function Tip({ text, placement, children }: { text: ReactNode; placement?: TooltipPlacement; children: ReactElement }) {
  return (
    <Tooltip content={tipContent(text)} placement={placement} arrow={false} className={surface}>
      {children}
    </Tooltip>
  );
}
