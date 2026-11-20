'use client';

import { Alert, Button } from '@e-burgos/tucu-ui';
import { useState } from 'react';
import type { ClaudeBrowserState } from '@sdd-studio/protocol';
import { useT, type TFunction } from '@/lib/i18n/i18n';
import { useChromeStatus } from './modules/claude/use-chrome-status';

type Key = Parameters<TFunction>[0];

const ACTIONABLE: readonly ClaudeBrowserState[] = ['permission-pending', 'debugging-disabled', 'chrome-closed', 'unknown'];

export function ChromeBanner() {
  const { t } = useT();
  const { supported, status, checking, check, openSettings } = useChromeStatus();
  const [dismissed, setDismissed] = useState<ClaudeBrowserState | null>(null);
  if (!supported || !status || !ACTIONABLE.includes(status.state) || dismissed === status.state) return null;
  const { state, detail } = status;
  const settings = state === 'debugging-disabled';
  const message = state === 'unknown' ? (detail ?? t('module.claude.chrome.banner.unknown')) : t(`module.claude.chrome.banner.${state}` as Key);
  const actionLabel = settings ? t('module.claude.chrome.action.openSettings') : t(state === 'permission-pending' ? 'module.claude.chrome.action.recheck' : 'module.claude.chrome.action.retry');
  return (
    <Alert
      variant="warning"
      density="compact"
      live="polite"
      dismissible
      onDismiss={() => setDismissed(state)}
      aria-label={t('module.claude.chrome.banner.label')}
      data-testid="chrome-banner"
      data-state={state}
      className="flex items-center justify-center gap-3 rounded-none border-x-0 border-t-0 text-ui shadow-none"
    >
      <span>{message}</span>
      <Button type="button" variant="ghost" color="warning" size="tiny" disabled={checking} onClick={() => void (settings ? openSettings() : check())}>
        {actionLabel}
      </Button>
    </Alert>
  );
}
