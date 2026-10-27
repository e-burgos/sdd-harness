'use client';

import { Badge, StateBadge, type StateBadgeTone } from '@e-burgos/tucu-ui';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { isFixStatus, normalizeSeverity, type FixStatus, type Severity } from './fix-model';

const SEVERITY_TONE: Record<Severity, 'danger' | 'warning' | 'info' | 'neutral'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
};

const STATUS_TONE: Record<FixStatus, StateBadgeTone> = {
  pending: 'orange',
  'in-progress': 'purple',
  implemented: 'teal',
  validated: 'green',
  absorbed: 'neutral',
};

export function useFixLabels() {
  const { t } = useT();
  return {
    severity: (severity: string | null): string => {
      const normalized = normalizeSeverity(severity);
      if (normalized !== null) return t(`fixes.severity.${normalized}` as keyof Dict);
      return severity !== null && severity.trim() !== '' ? severity : t('fixes.severity.none');
    },
    status: (status: string): string => (isFixStatus(status) ? t(`fixes.status.${status}` as keyof Dict) : status),
  };
}

export function SeverityChip({ severity, compact = false }: { severity: string | null; compact?: boolean }) {
  const { t } = useT();
  const labels = useFixLabels();
  const normalized = normalizeSeverity(severity);
  const label = labels.severity(severity);
  const text = compact && normalized === null && severity === null ? t('fixes.severity.noneShort') : label;
  return (
    <Badge
      variant="soft"
      size="tiny"
      shape="pill"
      tone={normalized === null ? 'neutral' : SEVERITY_TONE[normalized]}
      data-severity={normalized ?? 'none'}
      aria-label={compact ? label : undefined}
      className="shrink-0 px-1.5 py-0 text-micro"
    >
      {text}
    </Badge>
  );
}

export function FixStatusBadge({ status }: { status: string }) {
  const labels = useFixLabels();
  return (
    <StateBadge tone={isFixStatus(status) ? STATUS_TONE[status] : 'neutral'} size="sm" dot>
      {labels.status(status)}
    </StateBadge>
  );
}
