'use client';

import { Button, EmptyState, Skeleton } from '@e-burgos/tucu-ui';
import { TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { useNav } from '@/lib/nav/use-nav';
import { PANEL_TYPE } from '@/lib/typography-tokens';
import { filterByKinds, filterByQuery, groupByDay, type ActivityEntry } from './activity-model';
import { useActivityFeed, useActivityFilter } from './activity-scope';
import { KIT_TOOLS_SELECTION } from '../kit/kit-model';
import { entrySearchText } from './activity-text';
import { ActivityTimeline } from './ActivityTimeline';

function CenterEmpty({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState size="sm" title={title} description={description} action={action} />
    </div>
  );
}

export function ActivityCenter() {
  const { t } = useT();
  const { entries, status, retry } = useActivityFeed();
  const { selected, clear } = useActivityFilter();
  const [query, setQuery] = useModuleQuery('activity');
  const open = useNav((s) => s.open);
  const openHome = useNav((s) => s.openHome);

  const visible = useMemo(
    () => filterByQuery(filterByKinds(entries, selected), query, (entry) => entrySearchText(t, entry)),
    [entries, selected, query, t],
  );
  const days = useMemo(() => groupByDay(visible), [visible]);

  const navigate = (entry: ActivityEntry) => {
    const target = entry.target;
    if (target === null) return;
    if (target.kind === 'thread') openHome({ kind: 'thread', threadId: target.threadId });
    else if (target.kind === 'spec') open('specs', target.specId);
    else if (target.kind === 'fix') open('fixes', target.fixId);
    else open('kit', KIT_TOOLS_SELECTION);
  };

  const title = t('activity.center.title');
  const filtering = selected.length > 0 || query.trim() !== '';

  let body;
  if (status === 'loading' && entries.length === 0) {
    body = (
      <div role="status" aria-label={t('shell.panel.loading')} className="space-y-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} height="3rem" />
        ))}
      </div>
    );
  } else if (entries.length === 0) {
    body =
      status === 'error' ? null : <CenterEmpty title={t('activity.center.emptyTitle')} description={t('activity.center.emptyBody')} />;
  } else if (visible.length === 0) {
    body = (
      <CenterEmpty
        title={t('activity.center.noMatchTitle')}
        description={t('activity.center.noMatchBody')}
        action={
          filtering && (
            <Button
              type="button"
              size="tiny"
              variant="outline"
              color="gray"
              className="text-ui"
              onClick={() => {
                clear();
                setQuery('');
              }}
            >
              {t('shell.panel.clearFilter')}
            </Button>
          )
        }
      />
    );
  } else {
    body = <ActivityTimeline days={days} onOpen={navigate} />;
  }

  return (
    <section aria-label={title} className="flex h-full min-w-0 flex-col">
      <header className="flex min-h-12 shrink-0 items-center gap-3 border-b border-foreground/10 px-5 py-2">
        <h1 className={`${PANEL_TYPE.title} min-w-0 truncate`}>{title}</h1>
        {entries.length > 0 && <span className={`${PANEL_TYPE.meta} text-ink-300`}>{t('activity.center.count', { count: visible.length })}</span>}
      </header>
      {status === 'error' && (
        <div role="alert" className="flex shrink-0 items-center gap-2 border-b border-foreground/10 px-5 py-2">
          <TriangleAlert aria-hidden size={16} className="shrink-0 text-roseish" />
          <p className={`${PANEL_TYPE.item} min-w-0 flex-1 text-ink-200`}>{t('activity.center.loadError')}</p>
          <Button type="button" size="tiny" variant="outline" color="gray" className="text-ui" onClick={retry}>
            {t('shell.panel.retry')}
          </Button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{body}</div>
    </section>
  );
}
