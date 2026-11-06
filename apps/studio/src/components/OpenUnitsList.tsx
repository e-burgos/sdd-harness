'use client';

import { Badge } from '@e-burgos/tucu-ui';
import type { FileLeaseSummary, SessionBinding } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { leasesOfUnit, sessionsOfUnit, shortSessionId, unboundLeases, type OpenUnit } from '@/lib/open-units';
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

const LEASES_SHOWN = 5;

function LeasedFiles({ leases }: { leases: FileLeaseSummary[] }) {
  const { t } = useT();
  if (leases.length === 0) return null;
  const shown = leases.slice(0, LEASES_SHOWN);
  return (
    <ul className="space-y-0.5 pl-3.5" aria-label={t('units.leases')} data-testid="unit-leases">
      {shown.map((lease) => (
        <li
          key={lease.path}
          data-testid="unit-lease"
          className="flex items-center gap-1.5 font-mono text-micro text-ink-400"
          title={t('units.leaseBy', { harness: lease.harness, id: shortSessionId(lease.sessionId) })}
        >
          <span aria-hidden className="text-ink-500">⌁</span>
          <span className="truncate">{lease.path}</span>
          {lease.requestedBy.length > 0 && (
            <span data-testid="unit-lease-request" className="shrink-0 text-amber-300">
              {t('units.requestedBy', { who: lease.requestedBy.join(', ') })}
            </span>
          )}
        </li>
      ))}
      {leases.length > shown.length && (
        <li className="font-mono text-micro text-ink-500">{t('units.moreLeases', { n: leases.length - shown.length })}</li>
      )}
    </ul>
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
          <LeasedFiles leases={leasesOfUnit(snapshot, unit)} />
        </li>
      ))}
      {unboundLeases(snapshot).length > 0 && (
        <li data-testid="open-unit-unbound-leases" className="flex flex-col gap-1">
          <span className="font-mono text-meta uppercase text-ink-500">{t('units.unboundLeases')}</span>
          <LeasedFiles leases={unboundLeases(snapshot)} />
        </li>
      )}
    </ul>
  );
}
