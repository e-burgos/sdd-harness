'use client';

import { FilterBar, FilterPill } from '@e-burgos/tucu-ui';
import { useMemo } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { ModulePanel } from '../../shell/ModulePanel';
import { ACTIVITY_KINDS, countByKind, filterByQuery } from './activity-model';
import { useActivityFeed, useActivityFilter } from './activity-scope';
import { entrySearchText } from './activity-text';

export function ActivityPanel() {
  const { t } = useT();
  const { entries, status, retry } = useActivityFeed();
  const { selected, toggle, clear } = useActivityFilter();
  const [query] = useModuleQuery('activity');
  const counts = useMemo(() => countByKind(filterByQuery(entries, query, (entry) => entrySearchText(t, entry))), [entries, query, t]);
  const panelStatus = status === 'loading' && entries.length === 0 ? 'loading' : status === 'error' && entries.length === 0 ? 'error' : 'ready';

  return (
    <ModulePanel moduleId="activity" status={panelStatus} onRetry={retry}>
      <div data-studio-exempt="hosted-component" role="group" aria-label={t('activity.filter.label')} className="px-1 pt-1">
        <FilterBar
          activeCount={selected.length}
          onClear={clear}
          pills={
            <>
              <FilterPill active={selected.length === 0} onClick={clear}>
                {t('activity.filter.all')}
              </FilterPill>
              {ACTIVITY_KINDS.map((kind) => (
                <FilterPill key={kind} active={selected.includes(kind)} count={counts[kind]} onClick={() => toggle(kind)}>
                  {t(`activity.kind.${kind}`)}
                </FilterPill>
              ))}
            </>
          }
        />
      </div>
    </ModulePanel>
  );
}
