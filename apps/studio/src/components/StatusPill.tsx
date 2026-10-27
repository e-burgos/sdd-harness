'use client';

import { Badge } from '@e-burgos/tucu-ui';
import type { HTMLAttributes, ReactNode } from 'react';

export type PillTone = 'success' | 'info' | 'warning' | 'neutral';

const tones: Record<PillTone, string> = {
  success: 'border-emerald-500/20! bg-emerald-500/15! text-emerald-300!',
  info: 'border-sky-500/25! bg-sky-500/15! text-sky-300!',
  warning: 'border-amber-500/25! bg-amber-500/15! text-amber-300!',
  neutral: 'border-foreground/10! bg-foreground/10! text-ink-300!',
};

interface StatusPillProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  tone: PillTone;
  size?: 'micro' | 'meta';
  children: ReactNode;
}

export function StatusPill({ tone, size = 'micro', className = '', children, ...rest }: StatusPillProps) {
  return (
    <Badge variant="soft" color="gray" size="tiny" shape="pill" className={`h-auto! gap-1.5 px-2! py-0.5! font-mono ${size === 'meta' ? 'text-meta!' : 'text-micro!'} ${tones[tone]} ${className}`} {...rest}>
      {children}
    </Badge>
  );
}
