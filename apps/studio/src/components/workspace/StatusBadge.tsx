import { Badge } from '@e-burgos/tucu-ui';
import type { SessionStatus } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';

type BadgeColor = 'primary' | 'warning' | 'danger' | 'gray';

const COLORS: Record<SessionStatus, BadgeColor> = {
  queued: 'gray',
  running: 'primary',
  'waiting-approval': 'warning',
  idle: 'gray',
  interrupted: 'gray',
  error: 'danger',
};

export function StatusBadge({ status }: { status: SessionStatus }) {
  const { t } = useT();
  return (
    <Badge variant="soft" color={COLORS[status]} className="text-[11px]!">
      {t(`status.${status}`)}
    </Badge>
  );
}
