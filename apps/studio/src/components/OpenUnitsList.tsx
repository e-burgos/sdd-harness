'use client';

import { Badge } from '@e-burgos/tucu-ui';
import type { SessionBinding } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { sessionsOfUnit, shortSessionId, type OpenUnit } from '@/lib/open-units';
import { useStudio } from './BridgeProvider';

function SessionBadges({ sessions }: { sessions: SessionBinding[] }) {
  const { t } = useT();
  if (sessions.length === 0) return <span className="text-micro text-ink-500">{t('units.noSession')}</span>;
  return (
    <>
      {sessions.map((s) => (
        <Badge
          key={s.sessionId}
          variant="soft"
          size="micro"
          shape="pill"
          tone="info"
          data-testid="unit-session"
          title={t('units.sessionBy', { harness: s.harness, id: shortSessionId(s.sessionId) })}
          className="gap-1 px-2 py-0.5 font-mono text-micro"
        >
          {s.harness} · {shortSessionId(s.sessionId)}
        </Badge>
      ))}
    </>
  );
}

export function OpenUnitsList({ units, detailed = false }: { units: OpenUnit[]; detailed?: boolean }) {
  const { t } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  return (
    <ul className="space-y-2" data-testid="open-units-list">
      {units.map((unit) => (
        <li key={unit.key} data-testid="open-unit" data-unit={unit.key} className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-mono text-meta">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${unit.kind === 'fix' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span className="shrink-0 uppercase text-ink-500">{t(unit.kind === 'fix' ? 'units.fix' : 'units.cycle')}</span>
            <span className="truncate font-semibold text-ink-100" title={unit.label}>
              {unit.label}
            </span>
            {unit.kind === 'cycle' && (
              <span className="shrink-0 text-ink-500">
                {unit.flow} · {t('units.progress', { done: unit.done, total: unit.total })}
              </span>
            )}
            {unit.kind === 'fix' && detailed && <span className="truncate text-ink-400">{unit.title}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pl-3.5">
            <SessionBadges sessions={sessionsOfUnit(snapshot, unit)} />
          </div>
        </li>
      ))}
    </ul>
  );
}
