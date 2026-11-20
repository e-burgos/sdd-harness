'use client';

import { Badge, Tooltip } from '@e-burgos/tucu-ui';
import type { VerifyLeaseState } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { agoText, shortRepo } from '@/lib/kit-execution';
import { useStudio } from './BridgeProvider';

const STATE_STYLE: Record<VerifyLeaseState, { dot: string; text: string }> = {
  live: { dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-300' },
  stale: { dot: 'bg-ink-500', text: 'text-ink-500' },
  dead: { dot: 'bg-ink-500', text: 'text-ink-500 line-through' },
};

export function VerifyLeasePill() {
  const { t } = useT();
  const lease = useStudio((s) => s.snapshot?.verifyLease ?? null);
  if (!lease) return null;
  const style = STATE_STYLE[lease.state];
  const text = t('kitexec.lease.pill', { app: lease.app, repo: shortRepo(lease.repo), ago: agoText(lease.startedAt, Date.now(), t) });
  const tooltip = t('kitexec.lease.tooltip', { state: t(`kitexec.lease.state.${lease.state}` as Parameters<typeof t>[0]), host: lease.host, pid: lease.pid });
  return (
    <Tooltip size="xs" arrow={false} content={tooltip}>
      <Badge variant="soft" size="micro" shape="pill" tone="neutral" data-testid="verify-lease-pill" data-lease-state={lease.state} aria-label={tooltip} className={`hidden shrink-0 gap-1.5 whitespace-nowrap px-2.5 py-1 font-mono text-meta lg:flex ${style.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${style.dot} ${lease.state === 'live' ? 'animate-pulse' : ''}`} />
        <span>{text}</span>
      </Badge>
    </Tooltip>
  );
}
