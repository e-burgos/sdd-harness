'use client';

import { SegmentedControl } from '@e-burgos/tucu-ui';
import { channelForSpec, type SpecSummary } from '@sdd-studio/protocol';
import { useMemo, useState } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { botText } from '@/lib/format';
import { useNav } from '@/lib/nav/use-nav';
import { PANEL_TYPE } from '@/lib/typography-tokens';
import { useStudio } from '../../BridgeProvider';
import { PanelNotice } from '../../shell/PanelNotice';
import { RightPanelFrame } from '../../shell/RightPanelFrame';
import { activityEventsOf } from './specs-model';
import { useSpecThreads } from './use-spec-threads';

type RightTab = 'activity' | 'details';

function formatAt(at: string | undefined, locale: string): string {
  if (!at) return '';
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

function ActivityList({ spec }: { spec: SpecSummary }) {
  const { t, lang } = useT();
  const events = useStudio((s) => s.bot[channelForSpec(spec.id)]);
  const threads = useSpecThreads(spec.id);
  const sorted = useMemo(() => activityEventsOf(events ?? []), [events]);
  if (sorted.length === 0 && threads.length === 0) return <p className={`${PANEL_TYPE.item} text-ink-300`}>{t('specs.right.noActivity')}</p>;
  return (
    <div className="flex flex-col gap-3">
      {sorted.length > 0 && (
        <section>
          <h3 className={PANEL_TYPE.group}>{t('specs.right.events')}</h3>
          <ul className="mt-1 flex flex-col gap-2">
            {sorted.map((event, index) => (
              <li key={`${event.at ?? 'x'}-${index}`} className="flex flex-col">
                <span className={`${PANEL_TYPE.item} text-ink-100`}>{botText(t, event)}</span>
                {event.at && <span className={`${PANEL_TYPE.meta} text-ink-400`}>{formatAt(event.at, lang)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {threads.length > 0 && (
        <section className="border-t border-foreground/10 pt-2">
          <h3 className={PANEL_TYPE.group}>{t('specs.right.threads')}</h3>
          <ul className="mt-1 flex flex-col gap-2">
            {threads.map((info) => (
              <li key={info.id} className="flex flex-col">
                <span className={`${PANEL_TYPE.item} truncate text-ink-100`}>{info.title.trim() === '' ? t('specs.conv.untitled') : info.title}</span>
                <span className={`${PANEL_TYPE.meta} text-ink-400`}>
                  {t(`status.${info.status}`)} · {formatAt(info.lastActivity, lang)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-foreground/10 py-2 first:border-t-0 first:pt-0">
      <dt className={`${PANEL_TYPE.group}`}>{label}</dt>
      <dd className={`${PANEL_TYPE.item} min-w-0 break-words text-ink-100`}>{children}</dd>
    </div>
  );
}

function DetailsList({ spec }: { spec: SpecSummary }) {
  const { t } = useT();
  const specs = useStudio((s) => s.snapshot?.specs);
  const known = useMemo(() => new Set((specs ?? []).map((item) => item.id)), [specs]);
  const open = useNav((s) => s.open);
  const none = <span className="text-ink-400">{t('specs.right.none')}</span>;
  const unassigned = <span className="text-ink-400">{t('specs.right.unassigned')}</span>;
  return (
    <dl className="flex flex-col">
      <DetailRow label={t('specs.right.id')}>
        <span className="font-mono">{spec.id}</span>
      </DetailRow>
      <DetailRow label={t('specs.right.folder')}>
        <span className="font-mono">{spec.folder}</span>
      </DetailRow>
      <DetailRow label={t('specs.right.module')}>{spec.module ?? unassigned}</DetailRow>
      <DetailRow label={t('specs.right.app')}>{spec.app ?? unassigned}</DetailRow>
      <DetailRow label={t('specs.right.dependencies')}>
        {spec.dependsOn.length === 0 ? (
          none
        ) : (
          <ul className="flex flex-col gap-1">
            {spec.dependsOn.map((id) => (
              <li key={id}>
                {known.has(id) ? (
                  <button
                    type="button"
                    aria-label={t('specs.summary.openSpec', { id })}
                    onClick={() => open('specs', id)}
                    className="rounded-md font-mono text-accent-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
                  >
                    {id}
                  </button>
                ) : (
                  <span className="font-mono text-ink-400">{id}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </DetailRow>
    </dl>
  );
}

export function SpecsRight() {
  const { t } = useT();
  const selected = useNav((s) => s.selection.specs);
  const spec = useStudio((s) => (selected ? (s.snapshot?.specs.find((item) => item.id === selected) ?? null) : null));
  const [tab, setTab] = useState<RightTab>('activity');

  return (
    <RightPanelFrame title={spec?.title}>
      {spec ? (
        <div className="flex flex-col gap-3 pt-1">
          <SegmentedControl<RightTab>
            size="sm"
            fullWidth
            aria-label={t('specs.right.label')}
            value={tab}
            onChange={setTab}
            options={[
              { value: 'activity', label: t('specs.right.activity') },
              { value: 'details', label: t('specs.right.details') },
            ]}
          />
          {tab === 'activity' ? <ActivityList spec={spec} /> : <DetailsList spec={spec} />}
        </div>
      ) : (
        <PanelNotice message={t('specs.select')} />
      )}
    </RightPanelFrame>
  );
}
