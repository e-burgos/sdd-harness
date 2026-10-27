'use client';

import { FilterPill } from '@e-burgos/tucu-ui';
import { useMemo } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { useNav } from '@/lib/nav/use-nav';
import { useStudio } from '../../BridgeProvider';
import { CycleTrail, SpecStatusDot } from '../../workspace/NavParts';
import { ModulePanel } from '../../shell/ModulePanel';
import { PanelGroup } from '../../shell/PanelGroup';
import { PanelNotice } from '../../shell/PanelNotice';
import { PanelRow } from '../../shell/PanelRow';
import { buildSpecGroups, countByFilter, type SpecFilter, type SpecRowModel } from './specs-model';

const FILTERS: readonly SpecFilter[] = ['active', 'all', 'closed'];

function SpecRow({ row, selected, onSelect }: { row: SpecRowModel; selected: boolean; onSelect: () => void }) {
  const { t } = useT();
  const { spec, cycle } = row;
  const progress = cycle ? { cycle: cycle.cycle, flow: cycle.flow, done: cycle.tasksDone, total: cycle.tasksTotal } : null;
  return (
    <div data-spec-row={spec.id}>
      <PanelRow leading={<SpecStatusDot status={spec.status} />} label={spec.title} title={`${spec.title} · ${spec.id}`} selected={selected} onClick={onSelect} />
      <div onClick={onSelect} className="cursor-pointer pb-1 pl-7 pr-2">
        {progress ? <CycleTrail progress={progress} withCycle className="" /> : <span className="text-meta text-ink-400">{t('specs.row.noCycle')}</span>}
        {progress && progress.total === 0 && <span className="pl-1.5 text-meta text-ink-400">{t('specs.row.noTasks')}</span>}
      </div>
    </div>
  );
}

export function SpecsPanel() {
  const { t } = useT();
  const snapshot = useStudio((s) => s.snapshot);
  const [query] = useModuleQuery('specs');
  const filter = useNav((s) => s.filters.specs);
  const setFilter = useNav((s) => s.setFilter);
  const selected = useNav((s) => s.selection.specs);
  const select = useNav((s) => s.select);

  const groups = useMemo(() => (snapshot ? buildSpecGroups(snapshot, filter, query) : []), [snapshot, filter, query]);
  const counts = useMemo(() => (snapshot ? countByFilter(snapshot) : null), [snapshot]);

  if (!snapshot || !counts) return <ModulePanel moduleId="specs" status="loading" />;

  const projectEmpty = snapshot.specs.length === 0;
  const searching = query.trim() !== '';
  const emptyMessage = searching ? t('shell.panel.noResults', { query: query.trim() }) : t(`specs.empty.${filter}`);

  return (
    <ModulePanel moduleId="specs">
      {projectEmpty ? (
        <PanelNotice role="status" message={t('specs.empty.none')} />
      ) : (
        <>
          <div role="group" aria-label={t('specs.filter.label')} className="flex flex-wrap gap-1 px-1 pb-2 pt-1">
            {FILTERS.map((option) => (
              <FilterPill key={option} className="text-ui" active={filter === option} onClick={() => setFilter('specs', option)}>
                {t(`specs.filter.${option}`)}
                <span className="pl-1 text-meta opacity-70">{counts[option]}</span>
              </FilterPill>
            ))}
          </div>
          {groups.length === 0 ? (
            <PanelNotice role="status" message={emptyMessage} />
          ) : (
            groups.map((group) => (
              <PanelGroup key={group.key} id={group.key} title={t(`specs.group.${group.key}`)} count={group.rows.length}>
                {group.rows.map((row) => (
                  <SpecRow key={row.spec.id} row={row} selected={selected === row.spec.id} onSelect={() => select('specs', row.spec.id)} />
                ))}
              </PanelGroup>
            ))
          )}
        </>
      )}
    </ModulePanel>
  );
}
