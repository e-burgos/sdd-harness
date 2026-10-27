'use client';

import { useMemo, type ReactNode } from 'react';
import type { FixSummary, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import type { NavProgress } from '@/lib/store/nav-tree';
import { PANEL_TYPE } from '@/lib/typography-tokens';
import { Chip, CycleTrail, SeverityChip, SpecStatusDot } from '../../workspace/NavParts';
import { countBy, isFixOpen, normalizeSeverity, sortFixes, specRows, type Counter } from './derive';

const rowClass =
  'flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-copy hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';

export function SummarySection({ title, label, children }: { title: string; label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="rounded-lg border border-foreground/10 bg-ink-900">
      <h2 className={`${PANEL_TYPE.group} px-3 pt-2`}>{title}</h2>
      {children}
    </section>
  );
}

export function CounterRow({ label, counters, format }: { label: string; counters: Counter[]; format?: (key: string) => string }) {
  if (counters.length === 0) return null;
  return (
    <ul aria-label={label} className="flex flex-wrap items-center gap-1.5 px-3 py-2">
      {counters.map((counter) => (
        <li key={counter.key}>
          <Chip testId="summary-counter">{`${format ? format(counter.key) : counter.key} · ${counter.count}`}</Chip>
        </li>
      ))}
    </ul>
  );
}

const SPEC_TONE: Record<string, 'info' | 'success'> = { 'in-progress': 'info', completed: 'success' };

export function SpecsSummary({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  const { t } = useT();
  const open = useNav((s) => s.open);
  const rows = useMemo(() => specRows(snapshot), [snapshot]);
  const counters = useMemo(() => countBy(snapshot.specs, (spec) => spec.status), [snapshot.specs]);
  const stateLabel = (status: string) => (status === 'in-progress' || status === 'completed' ? t(`channel.status.${status}`) : status);
  return (
    <SummarySection title={t('home.specs.summary')} label={t('home.specs.summary')}>
      <CounterRow label={t('home.specs.counters')} counters={counters} format={stateLabel} />
      {rows.length === 0 ? (
        <p className={`${PANEL_TYPE.item} px-3 pb-3 text-ink-300`}>{t('home.specs.none')}</p>
      ) : (
        <ul className="max-h-64 overflow-y-auto px-1 pb-1">
          {rows.map(({ spec, cycle }) => {
            const progress: NavProgress | null = cycle && { cycle: cycle.cycle, flow: cycle.flow, done: cycle.tasksDone, total: cycle.tasksTotal };
            return (
              <li key={spec.id}>
                <button type="button" className={rowClass} aria-label={t('home.specs.open', { name: spec.id })} onClick={() => open('specs', spec.id)}>
                  <SpecStatusDot status={spec.status} />
                  <span className="min-w-0 flex-1 truncate">{spec.title || spec.id}</span>
                  <Chip tone={SPEC_TONE[spec.status] ?? 'neutral'}>{stateLabel(spec.status)}</Chip>
                  {progress ? (
                    <>
                      <CycleTrail progress={progress} withCycle />
                      {progress.total === 0 && <span className={`${PANEL_TYPE.meta} shrink-0 text-ink-400`}>{t('home.specs.noTasks')}</span>}
                    </>
                  ) : (
                    <span className={`${PANEL_TYPE.meta} shrink-0 text-ink-400`}>{t('home.specs.noCycle')}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SummarySection>
  );
}

export function FixSeverity({ severity }: { severity: string | null }) {
  const { t } = useT();
  if (severity !== null && severity.toLowerCase() === 'critical') return <Chip tone="danger" testId="severity-chip">{t('home.sev.critical')}</Chip>;
  return <SeverityChip severity={severity} />;
}

function FixRow({ fix }: { fix: FixSummary }) {
  const { t } = useT();
  const open = useNav((s) => s.open);
  return (
    <li>
      <button type="button" className={rowClass} aria-label={t('home.fixes.open', { name: fix.id })} onClick={() => open('fixes', fix.id)}>
        <FixSeverity severity={fix.severity} />
        <span className="min-w-0 flex-1 truncate">{fix.title || fix.id}</span>
        <Chip tone={isFixOpen(fix) ? 'warning' : 'success'}>{fix.status}</Chip>
      </button>
    </li>
  );
}

export function FixesSummary({ fixes }: { fixes: FixSummary[] }) {
  const { t } = useT();
  const sorted = useMemo(() => sortFixes(fixes), [fixes]);
  const byState = useMemo(() => countBy(fixes, (fix) => fix.status), [fixes]);
  const bySeverity = useMemo(() => countBy(sortFixes(fixes), (fix) => normalizeSeverity(fix.severity)), [fixes]);
  const severityLabel = (key: string) => (key === 'none' ? t('home.fixes.noSeverity') : key);
  return (
    <SummarySection title={t('home.fixes.summary')} label={t('home.fixes.summary')}>
      <CounterRow label={t('home.fixes.byState')} counters={byState} />
      <CounterRow label={t('home.fixes.bySeverity')} counters={bySeverity} format={severityLabel} />
      {sorted.length === 0 ? (
        <p className={`${PANEL_TYPE.item} px-3 pb-3 text-ink-300`}>{t('home.fixes.none')}</p>
      ) : (
        <ul className="max-h-64 overflow-y-auto px-1 pb-1">
          {sorted.map((fix) => (
            <FixRow key={fix.id} fix={fix} />
          ))}
        </ul>
      )}
    </SummarySection>
  );
}
