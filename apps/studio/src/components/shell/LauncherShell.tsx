'use client';

import { Button } from '@e-burgos/tucu-ui';
import { Rocket } from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { onboardingSteps } from '@/lib/onboarding';
import { useClaudeConnected } from '@/lib/use-claude-connected';
import { useBridge } from '../BridgeProvider';
import { ClaudeConnectDialog } from '../onboarding/ClaudeConnectDialog';
import { OnboardingSteps } from '../onboarding/OnboardingSteps';
import { MODULES } from '@/lib/nav/modules';
import { usePanelState } from '@/lib/use-panel-state';
import { COLLAPSED_WIDTH_PX, PANEL_WIDTH_PX, RIGHT_WIDTH_PX } from './StudioShell';
import { ModuleBoundary } from './ModuleBoundary';
import { PanelRail } from './PanelRail';
import { ShellActionsContext } from './shell-context';
import { useViewportTier } from './use-viewport-tier';

export function LauncherShell() {
  const { t } = useT();
  const { client } = useBridge();
  const [claudeOpen, setClaudeOpen] = useState(false);
  const claude = useClaudeConnected(claudeOpen);
  const steps = onboardingSteps({
    claudeConnected: claude.connected,
    projectOpen: false,
    githubSupported: client?.supports?.('github') === true,
    githubConnected: false,
    firstWorkDone: false,
  });
  const closeClaude = () => {
    setClaudeOpen(false);
    void claude.refresh();
  };
  const panels = usePanelState();
  const tier = useViewportTier();
  const [rightOpenWhenNarrow, setRightOpenWhenNarrow] = useState(false);
  const { Scope, Panel, Center, Right } = MODULES['new-project'];
  const narrow = tier === 'narrow';
  const rightCollapsed = tier === 'wide' ? panels.rightCollapsed : !rightOpenWhenNarrow;
  const panelCollapsed = panels.sidebarCollapsed;

  const actions = useMemo(
    () => ({
      collapsePanel: () => panels.setSidebarCollapsed(true),
      collapseRight: () => (tier === 'wide' ? panels.setRightCollapsed(true) : setRightOpenWhenNarrow(false)),
    }),
    [tier, panels],
  );
  const expandRight = () => (tier === 'wide' ? panels.setRightCollapsed(false) : setRightOpenWhenNarrow(true));

  const columns: string[] = [];
  if (!narrow) columns.push(panelCollapsed ? `${COLLAPSED_WIDTH_PX}px` : `${PANEL_WIDTH_PX}px`);
  columns.push('minmax(0,1fr)');
  if (Right && !narrow) columns.push(rightCollapsed ? `${COLLAPSED_WIDTH_PX}px` : `${RIGHT_WIDTH_PX}px`);
  const gridStyle: CSSProperties = { gridTemplateColumns: columns.join(' ') };
  const Wrapper = Scope ?? (({ children }: { children?: React.ReactNode }) => <>{children}</>);

  return (
    <ShellActionsContext.Provider value={actions}>
      <div data-testid="launcher-shell" className="flex min-h-0 flex-1 flex-col">
        <div data-testid="launcher-onboarding" className="flex shrink-0 flex-col gap-1 border-b border-foreground/10 bg-ink-900 px-4 py-2 text-small text-ink-300">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-2 font-medium text-ink-100">
              <Rocket aria-hidden size={16} className="shrink-0 text-accent-400" />
              {t('onboarding.title')}
            </span>
            <OnboardingSteps
              steps={steps}
              renderAction={(step) =>
                step.id === 'claude' && step.status !== 'done' ? (
                  <Button type="button" size="tiny" onClick={() => setClaudeOpen(true)}>
                    {t('onboarding.claude.connect')}
                  </Button>
                ) : null
              }
            />
          </div>
          <span className="min-w-0 truncate text-ink-400">{t('launcher.hint')}</span>
        </div>
        <ClaudeConnectDialog isOpen={claudeOpen} onClose={closeClaude} />
        <Wrapper>
          <div data-testid="shell-body" data-module="new-project" className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)]" style={gridStyle}>
            {!narrow &&
              (panelCollapsed ? (
                <PanelRail side="left" label={t('panel.sidebar.expand')} onExpand={() => panels.setSidebarCollapsed(false)} />
              ) : (
                <div className="min-h-0 min-w-0">
                  <ModuleBoundary resetKey="new-project">
                    <Panel />
                  </ModuleBoundary>
                </div>
              ))}
            <main data-testid="module-center" className="relative min-h-0 min-w-0 overflow-hidden">
              <ModuleBoundary resetKey="new-project">
                <Center />
              </ModuleBoundary>
            </main>
            {Right &&
              !narrow &&
              (rightCollapsed ? (
                <PanelRail side="right" label={t('panel.right.expand')} onExpand={expandRight} />
              ) : (
                <div className="min-h-0 min-w-0">
                  <ModuleBoundary resetKey="new-project">
                    <Right />
                  </ModuleBoundary>
                </div>
              ))}
          </div>
        </Wrapper>
      </div>
    </ShellActionsContext.Provider>
  );
}
