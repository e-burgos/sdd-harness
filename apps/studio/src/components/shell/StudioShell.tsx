'use client';

import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { MODULES, MODULE_ICONS } from '@/lib/nav/modules';
import type { ModuleId } from '@/lib/nav/module-ids';
import { useNav } from '@/lib/nav/use-nav';
import { useRailPreferences } from '@/lib/nav/use-rail-preferences';
import { MODULE_LABEL_KEY } from '@/lib/nav/module-labels';
import { usePanelState } from '@/lib/use-panel-state';
import { useBridge, useStudio } from '../BridgeProvider';
import { PanelRail } from '../workspace/PanelRail';
import { ModuleBoundary } from './ModuleBoundary';
import { ModuleRail } from './ModuleRail';
import { ShellActionsContext } from './shell-context';
import { useViewportTier } from './use-viewport-tier';

export const PANEL_WIDTH_PX = 240;
export const RIGHT_WIDTH_PX = 320;
export const COLLAPSED_WIDTH_PX = 44;

export function StudioShell() {
  const { t } = useT();
  const { connection } = useBridge();
  const project = useStudio((s) => s.snapshot?.project ?? (connection.status === 'open' ? connection.welcome?.workspace.project : undefined) ?? '');
  const kitVersion = useStudio((s) => s.snapshot?.kitVersion ?? null);
  const activeModule = useNav((s) => s.module);
  const setModule = useNav((s) => s.setModule);
  const startNewConversation = useNav((s) => s.startNewConversation);
  const panels = usePanelState();
  const preferences = useRailPreferences(project);
  const tier = useViewportTier();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [rightOpenWhenNarrow, setRightOpenWhenNarrow] = useState(false);

  const definition = MODULES[activeModule];
  const { Scope = Fragment, Panel, Center, Right } = definition;
  const legacy = definition.legacyCenter === true;
  const narrow = tier === 'narrow';
  const rightCollapsed = tier === 'wide' ? panels.rightCollapsed : !rightOpenWhenNarrow;
  const panelCollapsed = !narrow && panels.sidebarCollapsed;

  useEffect(() => setOverlayOpen(false), [narrow]);

  const selectModule = useCallback(
    (id: ModuleId) => {
      if (narrow) setOverlayOpen((open) => (id === activeModule ? !open : true));
      setModule(id);
    },
    [narrow, activeModule, setModule],
  );

  const actions = useMemo(
    () => ({
      collapsePanel: () => (narrow ? setOverlayOpen(false) : panels.setSidebarCollapsed(true)),
      collapseRight: () => (tier === 'wide' ? panels.setRightCollapsed(true) : setRightOpenWhenNarrow(false)),
    }),
    [narrow, tier, panels],
  );

  const expandRight = () => (tier === 'wide' ? panels.setRightCollapsed(false) : setRightOpenWhenNarrow(true));

  const columns: string[] = [];
  if (!legacy && !narrow) columns.push(panelCollapsed ? `${COLLAPSED_WIDTH_PX}px` : `${PANEL_WIDTH_PX}px`);
  columns.push('minmax(0,1fr)');
  if (!legacy && Right) columns.push(rightCollapsed ? `${COLLAPSED_WIDTH_PX}px` : `${RIGHT_WIDTH_PX}px`);
  const gridStyle: CSSProperties = { gridTemplateColumns: columns.join(' ') };

  const panelNode = (
    <ModuleBoundary resetKey={activeModule}>
      <Panel />
    </ModuleBoundary>
  );

  return (
    <ShellActionsContext.Provider value={actions}>
      <div className="flex min-h-0 flex-1">
        <ModuleRail
          project={project}
          kitVersion={kitVersion}
          activeModule={activeModule}
          icons={MODULE_ICONS}
          preferences={preferences}
          connection={connection.status}
          onSelectModule={selectModule}
          onNewConversation={startNewConversation}
        />
        <Scope>
          <div data-testid="shell-body" data-module={activeModule} className="relative grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)]" style={gridStyle}>
            {!legacy && !narrow &&
              (panelCollapsed ? (
                <PanelRail side="left" label={t('panel.sidebar.expand')} onExpand={() => panels.setSidebarCollapsed(false)} />
              ) : (
                <div className="min-h-0 min-w-0">{panelNode}</div>
              ))}
            <main data-testid="module-center" className="relative min-h-0 min-w-0 overflow-hidden">
              <ModuleBoundary resetKey={activeModule}>
                <Center />
              </ModuleBoundary>
            </main>
            {!legacy &&
              Right &&
              (rightCollapsed ? (
                <PanelRail side="right" label={t('panel.right.expand')} onExpand={expandRight} />
              ) : (
                <div className="min-h-0 min-w-0">
                  <ModuleBoundary resetKey={activeModule}>
                    <Right />
                  </ModuleBoundary>
                </div>
              ))}
            {!legacy && narrow && overlayOpen && (
              <>
                <button type="button" aria-label={t('shell.panel.close')} className="absolute inset-0 z-10 bg-black/40" onClick={() => setOverlayOpen(false)} />
                <div data-testid="panel-overlay" aria-label={t('shell.panel.open', { module: t(MODULE_LABEL_KEY[activeModule]) })} className="absolute inset-y-0 left-0 z-20 w-[min(280px,calc(100%-24px))] shadow-xl">
                  {panelNode}
                </div>
              </>
            )}
          </div>
        </Scope>
      </div>
    </ShellActionsContext.Provider>
  );
}
