'use client';

import { useMemo } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { useNav } from '@/lib/nav/use-nav';
import { ModulePanel } from '../../shell/ModulePanel';
import { PanelGroup } from '../../shell/PanelGroup';
import { PanelNotice } from '../../shell/PanelNotice';
import { PanelRow } from '../../shell/PanelRow';
import { SeverityChip, useFixLabels } from './FixBadges';
import { CLOSED_FIX_STATUSES } from '@/lib/sdd-status';
import { groupFixesByStatus, matchesFix, shortFixId } from './fix-model';
import { useFixes } from './use-fixes';

export function FixesPanel() {
  const { t } = useT();
  const labels = useFixLabels();
  const { snapshot, fixes, selectedId } = useFixes();
  const select = useNav((s) => s.select);
  const [query] = useModuleQuery('fixes');
  const groups = useMemo(
    () => groupFixesByStatus(fixes.filter((fix) => matchesFix(query, fix, { status: labels.status(fix.status), severity: labels.severity(fix.severity) }))),
    [fixes, query, labels],
  );
  return (
    <ModulePanel moduleId="fixes" status={snapshot === null ? 'loading' : 'ready'} hasResults={groups.length > 0}>
      {fixes.length === 0 ? (
        <PanelNotice role="status" message={t('fixes.panel.empty')} />
      ) : (
        groups.map(({ status, fixes: list }) => (
          <PanelGroup key={status} id={status} title={labels.status(status)} count={list.length} defaultCollapsed={CLOSED_FIX_STATUSES.has(status)}>
            {list.map((fix) => (
              <PanelRow
                key={fix.id}
                label={fix.title}
                leading={<SeverityChip severity={fix.severity} compact />}
                meta={shortFixId(fix.id)}
                title={`${fix.id} · ${fix.title}`}
                ariaLabel={t('fixes.panel.row', { id: fix.id, title: fix.title, status: labels.status(fix.status), severity: labels.severity(fix.severity) })}
                selected={selectedId === fix.id}
                onClick={() => select('fixes', fix.id)}
              />
            ))}
          </PanelGroup>
        ))
      )}
    </ModulePanel>
  );
}
