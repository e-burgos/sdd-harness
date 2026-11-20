'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { KitPackStats } from '@sdd-studio/protocol';
import { Button } from '@e-burgos/tucu-ui';
import { bridgeErrorText } from '@/lib/bridge/error-text';
import { formatKb } from '@/lib/format';
import { useT } from '@/lib/i18n/i18n';
import { useBridge } from '../../BridgeProvider';
import { Muted, Section } from './SpecParts';

type Loaded = { key: string; stats: KitPackStats } | { key: string; error: string };

export const packShare = (stats: KitPackStats): number => (stats.total.sourceBytes === 0 ? 0 : Math.round((stats.total.packBytes / stats.total.sourceBytes) * 100));

export function SpecPackStats({ spec, cycle }: { spec: string; cycle: string }) {
  const { t, lang } = useT();
  const { client } = useBridge();
  const key = `${spec}:${cycle}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  const load = useCallback(() => {
    const run = ++latest.current;
    setLoading(true);
    client.request({ cmd: 'kit.pack.stats', spec, cycle }).then(
      (data) => {
        if (run !== latest.current) return;
        const parsed = KitPackStats.safeParse(data);
        setLoaded(parsed.success ? { key, stats: parsed.data } : { key, error: t('packstats.invalid') });
        setLoading(false);
      },
      (e: unknown) => {
        if (run !== latest.current) return;
        setLoaded({ key, error: bridgeErrorText(e, t) });
        setLoading(false);
      },
    );
  }, [client, spec, cycle, key, t]);

  useEffect(() => {
    load();
    return () => {
      latest.current += 1;
    };
  }, [load]);

  const current = loaded && loaded.key === key ? loaded : null;
  return (
    <Section title={t('packstats.title')}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {current && 'stats' in current ? (
            <p data-testid="pack-stats-summary" className="text-copy text-ink-100">
              {t('packstats.summary', {
                percent: packShare(current.stats),
                pack: formatKb(current.stats.total.packBytes, lang),
                source: formatKb(current.stats.total.sourceBytes, lang),
                misses: current.stats.packMisses,
              })}
            </p>
          ) : current ? (
            <p role="alert" className="text-copy text-roseish">
              {current.error}
            </p>
          ) : (
            <Muted>{t('packstats.loading')}</Muted>
          )}
        </div>
        <Button type="button" size="tiny" variant="transparent" color="gray" disabled={loading} onClick={load}>
          {t('packstats.refresh')}
        </Button>
      </div>
      {current && 'stats' in current && current.stats.rows.length === 0 && <Muted>{t('packstats.empty')}</Muted>}
      {current && 'stats' in current && current.stats.rows.length > 0 && (
        <ul className="flex flex-col gap-px">
          {current.stats.rows.map((row) => (
            <li key={`${row.unit}:${row.role}`} data-pack-row={row.unit} className="flex min-h-6 items-center gap-2 font-mono text-meta text-ink-300">
              <span className="w-16 shrink-0 text-ink-100">{row.unit}</span>
              <span className="min-w-0 flex-1 truncate">{row.role}</span>
              <span className="shrink-0">{formatKb(row.packBytes, lang)}</span>
              <span className="shrink-0 text-ink-400">/ {formatKb(row.sourceBytes, lang)}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
