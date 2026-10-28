'use client';

import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { PANEL_TYPE } from '@/lib/typography-tokens';
import { PanelToggle } from './PanelRail';
import { useShellActions } from './shell-context';

export function RightPanelFrame({ title, actions, children }: { title?: string; actions?: ReactNode; children?: ReactNode }) {
  const { t } = useT();
  const { collapseRight } = useShellActions();
  const heading = title ?? t('shell.right.title');
  return (
    <aside data-studio-panel="right" aria-label={heading} className="flex h-full min-h-0 min-w-0 flex-col border-l border-foreground/10 bg-ink-900">
      <header className="flex h-12 shrink-0 items-center gap-1 px-3 pt-1">
        <h2 className={`${PANEL_TYPE.title} min-w-0 flex-1 truncate`}>{heading}</h2>
        {actions}
        <PanelToggle label={t('panel.right.collapse')} side="right" onClick={collapseRight} />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">{children}</div>
    </aside>
  );
}
