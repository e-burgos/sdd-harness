'use client';

import { Button, EmptyState, ErrorState, Skeleton } from '@e-burgos/tucu-ui';
import { Info, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';
import type { KitEntry } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { matchesQuery } from '@/lib/nav/search';
import { useModuleQuery } from '@/lib/nav/use-module-query';
import { PANEL_TYPE } from '@/lib/typography-tokens';
import { Markdown } from '../../workspace/Markdown';
import { PanelRow } from '../../shell/PanelRow';
import { useKitIndex } from './KitProvider';
import { fileNameOf, prettyJson } from './kit-model';
import { useKitFile } from './use-kit-file';

export function CenterFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex h-full min-h-0 flex-col px-4 pt-4">
      <h2 className={`flex h-7 shrink-0 items-center ${PANEL_TYPE.title} text-ink-100`}>{title}</h2>
      <div className="min-h-0 flex-1 overflow-y-auto pb-4 pt-2">{children}</div>
    </section>
  );
}

const NOTICE_TONES = {
  info: { box: 'border-foreground/10 bg-ink-900', icon: 'text-ink-400', glyph: Info },
  warning: { box: 'border-amberish/30 bg-amberish/10', icon: 'text-amberish', glyph: TriangleAlert },
  error: { box: 'border-roseish/30 bg-roseish/10', icon: 'text-roseish', glyph: TriangleAlert },
} as const;

export function Notice({
  tone = 'info',
  role = 'status',
  testId,
  onDismiss,
  dismissLabel,
  children,
}: {
  tone?: keyof typeof NOTICE_TONES;
  role?: 'status' | 'alert' | 'note';
  testId?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
  children: ReactNode;
}) {
  const { box, icon, glyph: Glyph } = NOTICE_TONES[tone];
  return (
    <div role={role} data-testid={testId} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-small text-ink-100 ${box}`}>
      <Glyph aria-hidden size={16} className={`mt-px shrink-0 ${icon}`} />
      <p className="min-w-0 flex-1 break-words">{children}</p>
      {onDismiss && (
        <button type="button" aria-label={dismissLabel} onClick={onDismiss} className="shrink-0 rounded-md p-0.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100">
          <X aria-hidden size={14} />
        </button>
      )}
    </div>
  );
}

export type FileMode = 'markdown' | 'json';

export function FileViewer({ path, mode }: { path: string; mode: FileMode }) {
  const { t } = useT();
  const { index } = useKitIndex();
  const file = useKitFile(path, index?.revision ?? null);
  if (file.status === 'idle' || file.status === 'loading') {
    return (
      <div role="status" aria-label={t('module.kit.doc.loading')} className="flex flex-col gap-2 py-2">
        <Skeleton height="1.25rem" width="40%" />
        <Skeleton height="1rem" />
        <Skeleton height="1rem" width="85%" />
        <Skeleton height="6rem" />
      </div>
    );
  }
  if (file.status === 'error') return <ErrorState size="sm" title={t('module.kit.doc.loadError', { path })} description={file.reason ? t(`module.kit.doc.reason.${file.reason}`) : undefined} />;
  return (
    <article data-testid="kit-file" data-path={path} className="min-w-0 text-ink-100">
      <p className="mb-2 truncate font-mono text-meta text-ink-400" title={path}>
        {path}
      </p>
      {mode === 'json' ? (
        <pre className="overflow-auto rounded-xl border border-foreground/10 bg-ink-950 p-4 font-mono text-ui leading-relaxed text-ink-100">{prettyJson(file.content)}</pre>
      ) : (
        <Markdown text={file.content} />
      )}
    </article>
  );
}

export function IndexGate({ children }: { children: (entries: KitEntry[]) => ReactNode }) {
  const { t } = useT();
  const { status, index, reload } = useKitIndex();
  if (status === 'unsupported') return <Notice testId="kit-index-unsupported">{t('module.kit.index.unsupported')}</Notice>;
  if (status === 'error') {
    return <ErrorState size="sm" title={t('module.kit.index.error')} onRetry={reload} retryLabel={t('module.kit.panel.retry')} />;
  }
  if (!index) {
    return (
      <div role="status" aria-label={t('module.kit.doc.loading')} className="flex flex-col gap-2 py-2">
        <Skeleton height="1.25rem" width="40%" />
        <Skeleton height="1rem" />
        <Skeleton height="1rem" width="70%" />
      </div>
    );
  }
  return (
    <>
      {index.truncated && <Notice tone="warning">{t('module.kit.index.truncated')}</Notice>}
      {children(index.entries)}
    </>
  );
}

export interface BrowserItem {
  entry: KitEntry;
  label: string;
  group?: string | null;
  badge?: string;
}

export function EntryBrowser({ title, items, mode, emptyTitle }: { title: string; items: BrowserItem[]; mode: FileMode; emptyTitle: string }) {
  const { t } = useT();
  const [chosen, setChosen] = useState<string | null>(null);
  const [query] = useModuleQuery('kit');
  if (items.length === 0) return <EmptyState size="sm" title={emptyTitle} />;
  const visible = items.filter((item) => matchesQuery(query, item.label, item.badge, item.group, fileNameOf(item.entry.path)));
  if (visible.length === 0) return <NoMatches />;
  const current = visible.find((item) => item.entry.path === chosen) ?? visible[0];
  const groups = visible.reduce<{ name: string | null; items: BrowserItem[] }[]>((acc, item) => {
    const name = item.group ?? null;
    const last = acc[acc.length - 1];
    if (last && last.name === name) last.items.push(item);
    else acc.push({ name, items: [item] });
    return acc;
  }, []);
  return (
    <div className="flex min-h-0 flex-col gap-3 md:flex-row">
      <nav aria-label={t('module.kit.index.files', { title })} className="flex shrink-0 flex-col gap-px md:w-60">
        {groups.map((group) => (
          <Fragment key={group.name ?? ''}>
            {group.name !== null && <p className={`${PANEL_TYPE.group} px-2 pb-1 pt-2`}>{group.name}</p>}
            {group.items.map((item) => (
              <PanelRow key={item.entry.path} label={item.label} meta={item.badge} title={item.entry.path} selected={item.entry.path === current.entry.path} onClick={() => setChosen(item.entry.path)} />
            ))}
          </Fragment>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <FileViewer key={current.entry.path} path={current.entry.path} mode={mode} />
      </div>
    </div>
  );
}

export const fileLabel = (entry: KitEntry): string => fileNameOf(entry.path);

export function IconButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <Button type="button" size="tiny" variant="ghost" color="gray" aria-label={label} onClick={onClick}>
      <Icon aria-hidden size={14} />
    </Button>
  );
}

export function NoMatches() {
  const { t } = useT();
  const [query, setQuery] = useModuleQuery('kit');
  return (
    <EmptyState
      size="sm"
      title={t('shell.panel.noResults', { query: query.trim() })}
      action={
        <Button type="button" size="tiny" variant="outline" color="gray" onClick={() => setQuery('')}>
          {t('shell.panel.clearFilter')}
        </Button>
      }
    />
  );
}
