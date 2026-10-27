'use client';

import { SearchX, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { PANEL_TYPE, ROW_ICON } from '@/lib/typography-tokens';

export function PanelNotice({ message, icon: Icon = SearchX, tone = 'neutral', action, role }: { message: string; icon?: LucideIcon; tone?: 'neutral' | 'error'; action?: ReactNode; role?: 'status' | 'alert' }) {
  return (
    <div role={role} className="flex flex-col items-start gap-2 px-3 py-4">
      <Icon aria-hidden size={ROW_ICON} className={tone === 'error' ? 'text-roseish' : 'text-ink-400'} />
      <p className={`${PANEL_TYPE.item} text-ink-300`}>{message}</p>
      {action}
    </div>
  );
}
