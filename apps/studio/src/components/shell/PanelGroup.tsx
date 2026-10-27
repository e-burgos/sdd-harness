'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { PANEL_TYPE, ROW_HEIGHT } from '@/lib/typography-tokens';
import { focusRing, usePanelScope } from './shell-context';

export interface PanelGroupProps {
  id: string;
  title: string;
  count?: number | string;
  defaultCollapsed?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

export function PanelGroup({ id, title, count, defaultCollapsed = false, actions, children }: PanelGroupProps) {
  const { t } = useT();
  const { moduleId, collapse, searching } = usePanelScope();
  const nodeId = `${moduleId}:${id}`;
  const collapsed = !searching && collapse.isCollapsed(nodeId, defaultCollapsed);
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  return (
    <section data-panel-group={id} className="border-t border-foreground/10 py-1 first:border-t-0">
      <div className={`flex ${ROW_HEIGHT} items-center gap-1`}>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={t('shell.panel.groupToggle', { name: title })}
          onClick={() => collapse.toggle(nodeId, defaultCollapsed)}
          className={`${focusRing} flex h-full min-w-0 flex-1 items-center gap-1 rounded-md px-2 text-left hover:bg-ink-800 ${PANEL_TYPE.group}`}
        >
          <Chevron aria-hidden size={14} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {count != null && <span className={`${PANEL_TYPE.meta} shrink-0 font-normal`}>{count}</span>}
        </button>
        {actions}
      </div>
      {!collapsed && <div className="flex flex-col gap-px">{children}</div>}
    </section>
  );
}
