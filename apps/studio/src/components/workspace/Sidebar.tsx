'use client';

import { useMemo, type ReactNode } from 'react';
import { SquaresFour } from '@phosphor-icons/react';
import type { AuthMode, Presence } from '@sdd-studio/protocol';
import { useT } from '@/lib/i18n/i18n';
import { buildNavTree, type NavSection, type NavThread, type NavView } from '@/lib/store/nav-tree';
import { useCollapsedState } from '@/lib/use-collapsed-state';
import type { ConnectionState } from '@/lib/bridge/client';
import { useBridge, useStudio } from '../BridgeProvider';
import { ApiKeyField } from './ApiKeyField';
import { SectionView, type NavTreeHandlers } from './NavTree';

const CONN_DOT = {
  open: { cls: 'bg-accent-400', key: 'conn.dot.open' },
  connecting: { cls: 'bg-amberish motion-safe:animate-pulse', key: 'conn.dot.connecting' },
  reconnecting: { cls: 'bg-amberish motion-safe:animate-pulse', key: 'conn.dot.connecting' },
  failed: { cls: 'bg-roseish', key: 'conn.dot.down' },
  idle: { cls: 'bg-roseish', key: 'conn.dot.down' },
} as const;
export interface SidebarViewProps {
  project: string;
  kitVersion: string | null;
  authMode: AuthMode | null;
  connection: ConnectionState['status'];
  tree: NavSection[];
  presence: Presence[];
  onSelectChannel(channelId: string): void;
  onOpenThread(thread: NavThread): void;
  authSlot?: ReactNode;
}

export function SidebarView(p: SidebarViewProps) {
  const { t, lang, setLang } = useT();
  const collapse = useCollapsedState(p.project);
  const dmState = (agent: string) => p.presence.find((x) => x.agent === agent)?.state ?? 'idle';
  const handlers: NavTreeHandlers = { collapse, stale: p.connection !== 'open', onSelectChannel: p.onSelectChannel, onOpenThread: p.onOpenThread };
  return (
    <nav className="flex h-full min-h-0 flex-col border-r border-ink-800 bg-ink-900">
      <header className="shrink-0 p-3 pb-2">
        <div className="truncate text-base font-semibold">{p.project}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-300">
          <span data-testid="conn-dot" aria-hidden className={`h-2 w-2 rounded-full ${CONN_DOT[p.connection].cls}`} />
          <span className="sr-only">{t(CONN_DOT[p.connection].key)}</span>
          {p.authMode ? t(`auth.${p.authMode}`) : '…'}
          {p.kitVersion && <span>· kit {p.kitVersion}</span>}
          <button className="ml-auto rounded hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>{t('lang.switch')}</button>
        </div>
        {p.authSlot}
      </header>
      <div data-testid="sidebar-tree" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {p.tree.map((section) => (
          <SectionView key={section.id} section={section} h={handlers} dmState={dmState} />
        ))}
      </div>
      <footer className="shrink-0 border-t border-ink-800 p-3">
        <section>
          <h2 className="mb-1 px-2 text-[11px] uppercase tracking-wider text-ink-500">{t('sidebar.views')}</h2>
          <div className="flex items-center gap-2 px-2 text-xs text-ink-500">
            <SquaresFour size={14} /> {t('sidebar.viewsSoon')}
          </div>
        </section>
      </footer>
    </nav>
  );
}

export function Sidebar({ view, onSelectChannel, onOpenThread }: { view: NavView; onSelectChannel(channelId: string): void; onOpenThread(thread: NavThread): void }) {
  const { connection, authMode } = useBridge();
  const snapshot = useStudio((s) => s.snapshot);
  const presence = useStudio((s) => s.presence);
  const threads = useStudio((s) => s.threads);
  const tree = useMemo(
    () => buildNavTree(snapshot, Object.values(threads).flatMap((t) => (t.info ? [t.info] : [])), view),
    [snapshot, threads, view],
  );
  const welcome = connection.status === 'open' ? connection.welcome : null;
  return (
    <SidebarView
      project={snapshot?.project ?? welcome?.workspace.project ?? '…'}
      kitVersion={snapshot?.kitVersion ?? null}
      authMode={authMode ?? welcome?.authMode ?? null}
      authSlot={<ApiKeyField />}
      connection={connection.status}
      tree={tree}
      presence={presence}
      onSelectChannel={onSelectChannel}
      onOpenThread={onOpenThread}
    />
  );
}
