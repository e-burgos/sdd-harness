'use client';

import { AnimatedTabs } from '@e-burgos/tucu-ui';
import { MessagesSquare, Activity } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useT } from '@/lib/i18n/i18n';
import type { Dict } from '@/lib/i18n/es';
import { useNav } from '@/lib/nav/use-nav';
import { botText } from '@/lib/format';
import { PanelNotice } from '../../shell/PanelNotice';
import { PanelRow } from '../../shell/PanelRow';
import { RightPanelFrame } from '../../shell/RightPanelFrame';
import { FixFacts } from './FixFacts';
import { formatFixDate } from './fix-date';
import { activityOfFix } from './fix-model';
import { useFixes } from './use-fixes';

type RightTab = 'activity' | 'details';

function FixActivity({ fixId }: { fixId: string }) {
  const { t, lang } = useT();
  const { events, threads } = useFixes();
  const openHome = useNav((s) => s.openHome);
  const items = useMemo(() => activityOfFix(fixId, events, threads), [fixId, events, threads]);
  if (items.length === 0) return <PanelNotice role="status" icon={Activity} message={t('fixes.right.noActivity')} />;
  return (
    <ul className="flex flex-col gap-px">
      {items.map((item) => (
        <li key={item.key}>
          {item.kind === 'thread' ? (
            <PanelRow
              icon={MessagesSquare}
              label={t('fixes.right.thread', { title: item.thread.title })}
              meta={formatFixDate(item.at, lang)}
              ariaLabel={t('fixes.card.openThread', { title: item.thread.title })}
              onClick={() => openHome({ kind: 'thread', threadId: item.thread.id })}
            />
          ) : (
            <div className="flex min-h-7 flex-col gap-px rounded-md px-2 py-1">
              <span className="text-copy text-ink-100">{botText(t, item.event)}</span>
              {item.at !== null && <span className="text-meta text-ink-400">{formatFixDate(item.at, lang)}</span>}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function FixesRight() {
  const { t } = useT();
  const { snapshot, selected } = useFixes();
  const [tab, setTab] = useState<RightTab>('activity');
  const tabs = [
    { id: 'activity' as const, label: t('fixes.right.activity') },
    { id: 'details' as const, label: t('fixes.right.details') },
  ];
  if (selected === null) {
    return (
      <RightPanelFrame title={t('fixes.right.title')}>
        <PanelNotice role="status" message={t('fixes.right.pick')} />
      </RightPanelFrame>
    );
  }
  const specAvailable = selected.specId !== null && (snapshot?.specs.some((spec) => spec.id === selected.specId) ?? false);
  return (
    <RightPanelFrame title={t('fixes.right.title')}>
      <div className="flex flex-col gap-3">
        <AnimatedTabs tabs={tabs} activeTab={tab} onChange={setTab} size="sm" mobile="scroll" />
        {tab === 'activity' ? <FixActivity fixId={selected.id} /> : <FixFacts fix={selected} specAvailable={specAvailable} layout="stack" />}
      </div>
    </RightPanelFrame>
  );
}
