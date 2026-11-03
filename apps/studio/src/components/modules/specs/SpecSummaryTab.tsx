'use client';

import type { SpecSummary } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { useStudio } from '../../BridgeProvider';
import { Chip } from '../../workspace/NavParts';
import { Item, Muted, Section, StatusBadge, shortCycleLabel } from './SpecParts';
import { fixesOfSpec, effectiveCycle } from './specs-model';
import { currentCycleOf, cyclesOf } from '@/lib/sdd-status';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-meta text-ink-400">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-copy text-ink-100">{children}</dd>
    </div>
  );
}

export function SpecSummaryTab({ spec }: { spec: SpecSummary }) {
  const { t } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const open = useNav((s) => s.open);
  const specCycle = useNav((s) => s.specCycle);
  const setSpecCycle = useNav((s) => s.setSpecCycle);
  if (!snapshot) return null;

  const current = currentCycleOf(snapshot.cycles, spec.id);
  const shown = effectiveCycle(snapshot.cycles, spec.id, specCycle);
  const own = cyclesOf(snapshot.cycles, spec.id);
  const fixes = fixesOfSpec(snapshot.fixes, spec.id);
  const gate = snapshot.tools?.gate ?? snapshot.gateMode;
  const known = new Set(snapshot.specs.map((s) => s.id));
  const subproject = [spec.app, spec.module].filter((v): v is string => !!v);

  return (
    <div className="flex flex-col">
      <Section title={t('specs.summary.cycle')}>
        {current ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Fact label={t('specs.summary.cycle')}>
              <span className="font-mono">{current.cycle}</span>
              <StatusBadge status={current.status} />
            </Fact>
            <Fact label={t('specs.summary.flow')}>
              <Chip>{current.flow}</Chip>
            </Fact>
            <Fact label={t('specs.summary.tasks')}>{current.tasksTotal > 0 ? t('specs.row.progress', { done: current.tasksDone, total: current.tasksTotal }) : t('specs.row.noTasks')}</Fact>
            <Fact label={t('specs.summary.gate')}>
              <Chip tone={gate === 'block' ? 'danger' : 'warning'}>{t(gate === 'block' ? 'specs.summary.gate.block' : 'specs.summary.gate.warn')}</Chip>
            </Fact>
          </dl>
        ) : (
          <Muted>{t('specs.summary.noCycles')}</Muted>
        )}
      </Section>

      <Section title={t('specs.summary.cycles')} count={own.length}>
        {own.length === 0 ? (
          <Muted>{t('specs.summary.noCycles')}</Muted>
        ) : (
          own.map((cycle) => (
            <Item
              key={cycle.cycle}
              mono
              label={cycle.cycle}
              selected={shown?.cycle === cycle.cycle}
              meta={`${cycle.flow} · ${cycle.tasksDone}/${cycle.tasksTotal}`}
              trailing={<StatusBadge status={cycle.status} />}
              onClick={() => setSpecCycle(cycle.cycle)}
            />
          ))
        )}
      </Section>

      <Section title={t('specs.summary.dependencies')} count={spec.dependsOn.length}>
        {spec.dependsOn.length === 0 ? (
          <Muted>{t('specs.summary.noDependencies')}</Muted>
        ) : (
          spec.dependsOn.map((id) =>
            known.has(id) ? (
              <Item key={id} mono label={id} ariaLabel={t('specs.summary.openSpec', { id })} onClick={() => open('specs', id)} />
            ) : (
              <Item key={id} mono disabled label={t('specs.summary.dependencyMissing', { id })} />
            ),
          )
        )}
      </Section>

      <Section title={t('specs.summary.subproject')}>
        {subproject.length === 0 ? <Muted>{t('specs.summary.noSubproject')}</Muted> : <p className="text-copy text-ink-100">{subproject.join(' · ')}</p>}
      </Section>

      <Section title={t('specs.summary.fixes')} count={fixes.length}>
        {fixes.length === 0 ? (
          <Muted>{t('specs.summary.noFixes')}</Muted>
        ) : (
          fixes.map((fix) => (
            <Item key={fix.id} label={`${fix.id} · ${fix.title}`} ariaLabel={t('specs.summary.openFix', { id: fix.id })} trailing={<StatusBadge status={fix.status} />} onClick={() => open('fixes', fix.id)} />
          ))
        )}
      </Section>

      <Section title={t('specs.summary.cycleTasks')} count={shown ? `${shortCycleLabel(shown.cycle)} · ${shown.tasks.length}` : undefined}>
        {!shown || shown.tasks.length === 0 ? (
          <Muted>{t('specs.summary.noTasks')}</Muted>
        ) : (
          shown.tasks.map((task) => <Item key={task.id} label={`${task.id} · ${task.title}`} trailing={<StatusBadge status={task.status} />} />)
        )}
      </Section>
    </div>
  );
}
