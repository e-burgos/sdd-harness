'use client';

import { ThreadInfo, type ThreadLinkTarget } from '@sdd-studio/protocol';
import { useMemo, useState } from 'react';
import { bridgeErrorText } from '@/lib/bridge/error-text';
import { useT } from '@/lib/i18n/i18n';
import { useBridge, useStudio } from '../BridgeProvider';

const NONE = 'none';
const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400';

export const encodeLinkTarget = (target: ThreadLinkTarget): string =>
  target.kind === 'cycle' ? `cycle:${target.specId}/${target.cycle}` : target.kind === 'fix' ? `fix:${target.fixId}` : NONE;

export function decodeLinkTarget(value: string): ThreadLinkTarget {
  if (value.startsWith('cycle:')) {
    const [specId = '', cycle = ''] = value.slice(6).split('/');
    return { kind: 'cycle', specId, cycle };
  }
  if (value.startsWith('fix:')) return { kind: 'fix', fixId: value.slice(4) };
  return { kind: 'none' };
}

const labelOf = (target: ThreadLinkTarget): string =>
  target.kind === 'cycle' ? `${target.specId} · ${target.cycle}` : target.kind === 'fix' ? target.fixId : '';

export function ThreadLinkPicker({ threadId }: { threadId: string }) {
  const { t } = useT();
  const { client, store } = useBridge();
  const snapshot = useStudio((s) => s.snapshot);
  const link = useStudio((s) => s.threads[threadId]?.info?.link ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => {
    const cycles = (snapshot?.cycles ?? [])
      .map((c) => ({ value: encodeLinkTarget({ kind: 'cycle', specId: c.specId, cycle: c.cycle }), label: `${c.specId} · ${c.cycle} (${c.status})` }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const fixes = (snapshot?.fixes ?? []).map((f) => ({ value: encodeLinkTarget({ kind: 'fix', fixId: f.id }), label: `${f.id} (${f.status})` }));
    return { cycles, fixes };
  }, [snapshot]);

  if (!link) return null;
  const current = encodeLinkTarget(link.target);
  const known = current === NONE || [...options.cycles, ...options.fixes].some((o) => o.value === current);

  const change = async (value: string) => {
    setSaving(true);
    setError(null);
    try {
      const updated = ThreadInfo.parse(await client.request({ cmd: 'thread.setLink', threadId, link: decodeLinkTarget(value) }));
      store.getState().setThreads([updated]);
    } catch (e) {
      setError(t('link.error', { message: bridgeErrorText(e, t) }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-ink-300">
      <label htmlFor="thread-link">{t('link.label')}</label>
      <select
        id="thread-link"
        className={`max-w-[16rem] truncate rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-xs text-ink-100 disabled:opacity-40 ${ring}`}
        value={current}
        disabled={saving}
        onChange={(e) => void change(e.target.value)}
      >
        <option value={NONE}>{t('link.none')}</option>
        {!known && <option value={current}>{labelOf(link.target)}</option>}
        {options.cycles.length > 0 && (
          <optgroup label={t('link.cycles')}>
            {options.cycles.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
        )}
        {options.fixes.length > 0 && (
          <optgroup label={t('link.fixes')}>
            {options.fixes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
        )}
      </select>
      {error && <p role="alert" className="basis-full text-roseish">{error}</p>}
    </div>
  );
}
