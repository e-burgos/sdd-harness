import { Badge } from '@e-burgos/tucu-ui';
import type { ReactNode } from 'react';
import type { Presence, SessionStatus } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import type { NavProgress } from '@/lib/store/nav-tree';
import { AgentAvatar } from './AgentAvatar';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export function Chip({ tone = 'neutral', children, testId }: { tone?: Tone; children: ReactNode; testId?: string }) {
  return (
    <Badge variant="soft" size="tiny" shape="pill" tone={tone} data-testid={testId} className="shrink-0 px-1.5 py-0 font-mono text-micro">
      {children}
    </Badge>
  );
}

const SPEC_DOT = {
  'in-progress': 'bg-accent-400',
  completed: 'bg-emerald-400',
} as const;

export function SpecStatusDot({ status }: { status: string | null }) {
  const cls = status !== null && status in SPEC_DOT ? SPEC_DOT[status as keyof typeof SPEC_DOT] : 'border border-dashed border-ink-500';
  return <span aria-hidden data-testid="spec-status-dot" data-status={status ?? 'none'} className={`h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

export const shortCycle = (cycle: string) => `c${cycle.slice(6)}`;

export function CycleTrail({ progress, withCycle, className = 'shrink-0 pl-1 pr-1' }: { progress: NavProgress | null; withCycle: boolean; className?: string }) {
  const { t } = useT();
  if (progress === null) return null;
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <Chip testId="cycle-chip">{withCycle ? `${shortCycle(progress.cycle)} · ${progress.flow}` : progress.flow}</Chip>
      {progress.total > 0 && (
        <span className="flex items-center gap-1" data-testid="mini-progress">
          <span aria-hidden className="h-[3px] w-11 overflow-hidden rounded-full bg-ink-700">
            <span className="block h-full rounded-full bg-accent-400" style={{ width: `${percent}%` }} />
          </span>
          <span aria-hidden className="font-mono text-micro text-ink-400">
            {progress.done}/{progress.total}
          </span>
          <span className="sr-only">{t('sidebar.tasksDone', { done: progress.done, total: progress.total })}</span>
        </span>
      )}
    </span>
  );
}

const SEVERITY: Record<string, { tone: Tone; key: 'sidebar.sev.high' | 'sidebar.sev.medium' | 'sidebar.sev.low' }> = {
  alta: { tone: 'danger', key: 'sidebar.sev.high' },
  high: { tone: 'danger', key: 'sidebar.sev.high' },
  media: { tone: 'warning', key: 'sidebar.sev.medium' },
  medium: { tone: 'warning', key: 'sidebar.sev.medium' },
  baja: { tone: 'neutral', key: 'sidebar.sev.low' },
  low: { tone: 'neutral', key: 'sidebar.sev.low' },
};

export function SeverityChip({ severity }: { severity: string | null }) {
  const { t } = useT();
  const entry = severity === null ? undefined : SEVERITY[severity.toLowerCase()];
  return entry ? <Chip tone={entry.tone} testId="severity-chip">{t(entry.key)}</Chip> : null;
}

const RING = {
  working: 'ring-2 ring-emerald-400 motion-safe:animate-pulse',
  waiting: 'ring-2 ring-amber-400',
  open: '',
  idle: '',
} as const;

export function PresenceAvatar({ agent, state, size }: { agent: string; state: Presence['state']; size: number }) {
  return (
    <span aria-hidden data-testid="presence-ring" data-state={state} className={`inline-flex shrink-0 rounded-xl ${RING[state]}`}>
      <AgentAvatar agent={agent} size={size} />
    </span>
  );
}

const STATUS_CHIP: Partial<Record<SessionStatus, { tone: Tone; key: 'sidebar.chip.working' | 'sidebar.chip.approve' | 'sidebar.chip.queued' }>> = {
  running: { tone: 'success', key: 'sidebar.chip.working' },
  'waiting-approval': { tone: 'warning', key: 'sidebar.chip.approve' },
  queued: { tone: 'neutral', key: 'sidebar.chip.queued' },
};

export function ThreadStatusChip({ status }: { status: SessionStatus }) {
  const { t } = useT();
  const entry = STATUS_CHIP[status];
  if (!entry) return null;
  return (
    <>
      <span aria-hidden>
        <Chip tone={entry.tone} testId="thread-status-chip">
          {t(entry.key)}
        </Chip>
      </span>
      <span className="sr-only">, {t(`status.${status}`)}</span>
    </>
  );
}
