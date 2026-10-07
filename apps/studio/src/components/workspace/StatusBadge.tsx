import type { SessionStatus } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';

const COLORS: Record<SessionStatus, string> = {
  queued: 'bg-ink-700 text-ink-300',
  running: 'bg-accent-dim text-accent-300',
  'waiting-approval': 'bg-amberish/15 text-amberish',
  idle: 'bg-ink-800 text-ink-300',
  interrupted: 'bg-ink-700 text-ink-300',
  error: 'bg-roseish/15 text-roseish',
};

export function StatusBadge({ status }: { status: SessionStatus }) {
  const { t } = useT();
  return <span className={`rounded-full px-2 py-0.5 text-[11px] ${COLORS[status]}`}>{t(`status.${status}`)}</span>;
}
