'use client';

import { MAX_LINK_TARGETS, ThreadInfo, type ThreadLinkRef, type ThreadLinkTarget } from '@sdd-studio/protocol';
import { Tooltip } from '@e-burgos/tucu-ui';
import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { bridgeErrorText } from '@/lib/bridge/error-text';
import { useT } from '@/lib/i18n/i18n';
import { deriveConversation } from '@/lib/conversation';
import { deriveConversationGate } from '@/lib/conversation-gate';
import { isLinkEntryAvailable, linkEntriesOf, linkRefKey, linkRefLabel, toLinkRef } from '@/lib/link-targets';
import { useBridgeFeatures } from '@/lib/use-bridge-features';
import { useBridge, useStudio } from '../BridgeProvider';
import { CapabilityNotice } from '../mission-control/CapabilityNotice';
import { HelpSelect, type HelpSelectOption } from '../HelpSelect';

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
  target.kind === 'cycle' ? (target.cycle ? `${target.specId} · ${target.cycle}` : target.specId) : target.kind === 'fix' ? target.fixId : '';

const decodeLinkRef = (value: string): ThreadLinkRef | null => {
  if (value.startsWith('spec:')) return { kind: 'spec', specId: value.slice(5) };
  if (value.startsWith('cycle:')) {
    const [specId = '', cycle = ''] = value.slice(6).split('/');
    return { kind: 'cycle', specId, cycle };
  }
  return value.startsWith('fix:') ? { kind: 'fix', fixId: value.slice(4) } : null;
};

export function ThreadLinkPicker({ threadId }: { threadId: string }) {
  const { t } = useT();
  const { client, store } = useBridge();
  const { supports } = useBridgeFeatures();
  const multiple = supports('link-targets');
  const snapshot = useStudio((s) => s.snapshot);
  const link = useStudio((s) => s.threads[threadId]?.info?.link ?? null);
  const thread = useStudio((s) => s.threads[threadId]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries = useMemo(() => (thread?.info ? linkEntriesOf(thread.info) : []), [thread?.info]);

  const options = useMemo(() => {
    const linked = new Set(entries.map((entry) => linkRefKey(toLinkRef(entry))));
    const specs = (snapshot?.specs ?? []).map((s) => ({ value: linkRefKey({ kind: 'spec', specId: s.id }), label: s.id, description: s.status }));
    const cycles = (snapshot?.cycles ?? [])
      .map((c) => ({ value: encodeLinkTarget({ kind: 'cycle', specId: c.specId, cycle: c.cycle }), label: `${c.specId} · ${c.cycle}`, description: c.status, triggerLabel: `${c.specId} · ${c.cycle} (${c.status})` }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const fixes = (snapshot?.fixes ?? []).map((f) => ({ value: encodeLinkTarget({ kind: 'fix', fixId: f.id }), label: f.id, description: f.status, triggerLabel: `${f.id} (${f.status})` }));
    const free = (list: HelpSelectOption[]) => list.filter((o) => !linked.has(o.value));
    return { cycles, fixes, specs: free(specs), freeCycles: free(cycles), freeFixes: free(fixes) };
  }, [snapshot, entries]);

  const detected = useMemo(() => {
    if (!thread?.info || entries.length > 0) return null;
    const gate = deriveConversationGate(deriveConversation(thread, snapshot), snapshot);
    if (gate.kind === 'fix') return gate.fixId;
    return gate.kind === 'spec' ? labelOf({ kind: 'cycle', specId: gate.specId, cycle: gate.cycle ?? '' }) : null;
  }, [thread, snapshot, entries]);

  if (!link) return null;
  const current = encodeLinkTarget(link.target);
  const known = current === NONE || [...options.cycles, ...options.fixes].some((o) => o.value === current);

  const run = async (command: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const updated = ThreadInfo.parse(await client.request(command as never));
      store.getState().setThreads([updated]);
    } catch (e) {
      setError(t('link.error', { message: bridgeErrorText(e, t) }));
    } finally {
      setSaving(false);
    }
  };

  const change = (value: string) => run({ cmd: 'thread.setLink', threadId, link: decodeLinkTarget(value) });
  const add = (value: string) => {
    const ref = decodeLinkRef(value);
    return ref ? run({ cmd: 'thread.updateLinks', threadId, add: [ref], remove: [] }) : undefined;
  };
  const remove = (ref: ThreadLinkRef) => run({ cmd: 'thread.updateLinks', threadId, add: [], remove: [ref] });

  const detectedNote = detected && (
    <span data-testid="link-detected" className="truncate font-mono text-meta text-ink-400" title={detected}>
      {t('link.detected', { target: detected })}
    </span>
  );
  const errorNote = error && <p role="alert" className="basis-full text-roseish">{error}</p>;
  const grouped = (heading: string, list: HelpSelectOption[]): HelpSelectOption[] =>
    list.map((o) => ({ ...o, group: heading }));

  if (!multiple) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-ink-300">
        <span aria-hidden>{t('link.label')}</span>
        <HelpSelect
          label={t('link.label')}
          help={t('help.link.target')}
          searchable
          className="max-w-[16rem]"
          value={current}
          disabled={saving}
          options={[
            { value: NONE, label: t('link.none') },
            ...(known ? [] : [{ value: current, label: labelOf(link.target) }]),
            ...grouped(t('link.cycles'), options.cycles),
            ...grouped(t('link.fixes'), options.fixes),
          ]}
          onChange={(value) => void change(value)}
        />
        {detectedNote}
        <CapabilityNotice capabilities={['link-targets']} />
        {errorNote}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-ink-300">
      <span aria-hidden>{t('link.label')}</span>
      <ul data-testid="link-chips" className="flex min-w-0 flex-wrap items-center gap-1.5">
        {entries.length === 0 && <li className="text-ink-400">{t('link.none')}</li>}
        {entries.map((entry) => {
          const ref = toLinkRef(entry);
          const label = linkRefLabel(ref);
          const available = isLinkEntryAvailable(ref, snapshot);
          return (
            <li key={linkRefKey(ref)} data-testid={`link-chip-${linkRefKey(ref)}`} className="flex min-w-0 items-center gap-1 rounded-md border border-ink-700 bg-ink-950 px-1.5 py-0.5">
              <span className={`truncate font-mono text-meta ${available ? 'text-ink-100' : 'text-ink-400 line-through'}`} title={label}>{label}</span>
              <span data-testid="link-origin" className="shrink-0 text-micro uppercase text-ink-500">{t(`link.origin.${entry.origin}`)}</span>
              {!available && <span data-testid="link-unavailable" className="shrink-0 text-micro text-amberish">{t('link.unavailable')}</span>}
              <Tooltip lazy size="xs" arrow={false} content={t('link.remove', { target: label })}>
                <button
                  type="button"
                  aria-label={t('link.remove', { target: label })}
                  disabled={saving}
                  onClick={() => void remove(ref)}
                  className={`shrink-0 rounded text-ink-400 hover:text-ink-100 disabled:opacity-40 ${ring}`}
                >
                  <X size={12} aria-hidden />
                </button>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      <HelpSelect
        label={t('link.label')}
        help={t('help.link.add')}
        searchable
        className="max-w-[16rem]"
        value=""
        disabled={saving || entries.length >= MAX_LINK_TARGETS}
        options={[
          { value: '', label: entries.length >= MAX_LINK_TARGETS ? t('link.max') : t('link.add') },
          ...grouped(t('link.specs'), options.specs),
          ...grouped(t('link.cycles'), options.freeCycles),
          ...grouped(t('link.fixes'), options.freeFixes),
        ]}
        onChange={(value) => void add(value)}
      />
      {detectedNote}
      {errorNote}
    </div>
  );
}
