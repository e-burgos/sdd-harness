'use client';

import { Button } from '@e-burgos/tucu-ui';
import { TriangleAlert } from 'lucide-react';
import { useMemo, useRef, type ReactNode } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { MODULE_LABEL_KEY } from '@/lib/nav/module-labels';
import type { ModuleId } from '@/lib/nav/module-ids';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { PANEL_TYPE } from '@/lib/typography-tokens';
import { useCollapsedState } from '@/lib/use-collapsed-state';
import { useStudio } from '../BridgeProvider';
import { SidebarSearch } from '../workspace/SidebarSearch';
import { PanelToggle } from '../workspace/PanelRail';
import { PanelNotice } from './PanelNotice';
import { PanelSkeleton } from './PanelSkeleton';
import { PanelScopeContext, useShellActions } from './shell-context';

export type PanelStatus = 'ready' | 'loading' | 'error';

export interface ModulePanelProps {
  moduleId: ModuleId;
  title?: string;
  actions?: ReactNode;
  searchable?: boolean;
  status?: PanelStatus;
  hasResults?: boolean;
  onRetry?: () => void;
  children?: ReactNode;
}

export function ModulePanel({ moduleId, title, actions, searchable = true, status = 'ready', hasResults = true, onRetry, children }: ModulePanelProps) {
  const { t } = useT();
  const { collapsePanel } = useShellActions();
  const project = useStudio((s) => s.snapshot?.project ?? '');
  const collapse = useCollapsedState(project);
  const [query, setQuery] = useModuleQuery(moduleId);
  const list = useRef<HTMLDivElement>(null);
  const heading = title ?? t(MODULE_LABEL_KEY[moduleId]);
  const searching = query.trim() !== '';
  const scope = useMemo(() => ({ moduleId, collapse, searching }), [moduleId, collapse, searching]);

  const body =
    status === 'loading' ? (
      <PanelSkeleton />
    ) : status === 'error' ? (
      <PanelNotice
        role="alert"
        tone="error"
        icon={TriangleAlert}
        message={t('shell.panel.loadError')}
        action={onRetry && <Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" onClick={onRetry}>{t('shell.panel.retry')}</Button>}
      />
    ) : searching && !hasResults ? (
      <PanelNotice
        role="status"
        message={t('shell.panel.noResults', { query: query.trim() })}
        action={<Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" onClick={() => setQuery('')}>{t('shell.panel.clearFilter')}</Button>}
      />
    ) : (
      children
    );

  return (
    <aside data-studio-panel={moduleId} aria-label={heading} className="flex h-full min-h-0 min-w-0 flex-col border-r border-foreground/10 bg-ink-900">
      <header className="flex shrink-0 flex-col gap-2 px-3 pb-2 pt-3">
        <div className="flex h-7 items-center gap-1">
          <h2 className={`${PANEL_TYPE.title} min-w-0 flex-1 truncate`}>{heading}</h2>
          {actions}
          <PanelToggle label={t('panel.sidebar.collapse')} side="left" onClick={collapsePanel} />
        </div>
        {searchable && (
          <SidebarSearch
            value={query}
            onChange={setQuery}
            label={t('shell.panel.search', { module: heading })}
            onLeave={() => list.current?.focus()}
          />
        )}
      </header>
      <div ref={list} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 focus:outline-none">
        <PanelScopeContext.Provider value={scope}>{body}</PanelScopeContext.Provider>
      </div>
    </aside>
  );
}
