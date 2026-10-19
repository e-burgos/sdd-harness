'use client';

import { SquaresFour } from '@phosphor-icons/react';
import { dmAgentOfChannel, type AuthMode, type Presence } from '@sdd-studio/protocol';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { channelsOf, dmChannelsOf, type ChannelEntry } from '@/lib/store/selectors';
import type { ConnectionState } from '@/lib/bridge/client';
import { useBridge, useStudio } from '../BridgeProvider';

const DOT: Record<Presence['state'], string> = {
  working: 'bg-accent-400 animate-pulse',
  waiting: 'bg-amberish',
  open: 'bg-accent-500/60',
  idle: 'border border-ink-500',
};
const CONN_DOT = {
  open: { cls: 'bg-accent-400', key: 'conn.dot.open' },
  connecting: { cls: 'bg-amberish animate-pulse motion-reduce:animate-none', key: 'conn.dot.connecting' },
  reconnecting: { cls: 'bg-amberish animate-pulse motion-reduce:animate-none', key: 'conn.dot.connecting' },
  failed: { cls: 'bg-roseish', key: 'conn.dot.down' },
  idle: { cls: 'bg-roseish', key: 'conn.dot.down' },
} as const;
const PRESENCE_KEY = { working: 'presence.working', waiting: 'presence.waiting', open: 'presence.open', idle: 'presence.idle' } as const;

export interface SidebarViewProps {
  project: string;
  kitVersion: string | null;
  authMode: AuthMode | null;
  connection: ConnectionState['status'];
  channels: ChannelEntry[];
  dms: ChannelEntry[];
  presence: Presence[];
  activeChannel: string;
  onSelect(channelId: string): void;
}

export function SidebarView(p: SidebarViewProps) {
  const { t, lang, setLang } = useT();
  const stateOf = (agent: string) => p.presence.find((x) => x.agent === agent)?.state ?? 'idle';
  const statusText = (status: string) => (status === 'in-progress' || status === 'completed' ? t(`channel.status.${status}`) : status);
  const item = (active: boolean) =>
    `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm ${active ? 'bg-accent-dim text-accent-300' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'}`;
  return (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto border-r border-ink-800 bg-ink-900 p-3">
      <header>
        <div className="truncate text-base font-semibold">{p.project}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-300">
          <span data-testid="conn-dot" aria-hidden className={`h-2 w-2 rounded-full ${CONN_DOT[p.connection].cls}`} />
          <span className="sr-only">{t(CONN_DOT[p.connection].key)}</span>
          {p.authMode ? t(`auth.${p.authMode}`) : '…'}
          {p.kitVersion && <span>· kit {p.kitVersion}</span>}
          <button className="ml-auto rounded hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>{t('lang.switch')}</button>
        </div>
      </header>
      <section>
        <h2 className="mb-1 px-2 text-[11px] uppercase tracking-wider text-ink-500">{t('sidebar.channels')}</h2>
        {p.channels.map((c) => (
          <button key={c.id} className={item(p.activeChannel === c.id)} aria-current={p.activeChannel === c.id ? 'page' : undefined} onClick={() => p.onSelect(c.id)}>
            <span className="truncate"># {c.label}</span>
            {c.status === 'in-progress' && (
              <>
                <span aria-hidden className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-400" />
                <span className="sr-only">, {statusText(c.status)}</span>
              </>
            )}
            {c.status === 'completed' && (
              <>
                <span aria-hidden className="ml-auto text-[10px] text-ink-500">✓</span>
                <span className="sr-only">, {statusText(c.status)}</span>
              </>
            )}
          </button>
        ))}
      </section>
      <section>
        <h2 className="mb-1 px-2 text-[11px] uppercase tracking-wider text-ink-500">{t('sidebar.agents')}</h2>
        {p.dms.map((c) => {
          const agent = dmAgentOfChannel(c.id) ?? c.label;
          const state = stateOf(agent);
          const meta = agentMeta(agent);
          return (
            <button key={c.id} className={item(p.activeChannel === c.id)} aria-current={p.activeChannel === c.id ? 'page' : undefined} onClick={() => p.onSelect(c.id)}>
              <span aria-hidden className={`h-2 w-2 rounded-full ${DOT[state]}`} />
              <span className="truncate">{meta.name}</span>
              <span className="sr-only">, {t(PRESENCE_KEY[state])}</span>
            </button>
          );
        })}
      </section>
      <section>
        <h2 className="mb-1 px-2 text-[11px] uppercase tracking-wider text-ink-500">{t('sidebar.views')}</h2>
        <div className="flex items-center gap-2 px-2 text-xs text-ink-500">
          <SquaresFour size={14} /> {t('sidebar.viewsSoon')}
        </div>
      </section>
    </nav>
  );
}

export function Sidebar({ activeChannel, onSelect }: { activeChannel: string; onSelect(channelId: string): void }) {
  const { connection } = useBridge();
  const snapshot = useStudio((s) => s.snapshot);
  const presence = useStudio((s) => s.presence);
  const welcome = connection.status === 'open' ? connection.welcome : null;
  return (
    <SidebarView
      project={snapshot?.project ?? welcome?.workspace.project ?? '…'}
      kitVersion={snapshot?.kitVersion ?? null}
      authMode={welcome?.authMode ?? null}
      connection={connection.status}
      channels={channelsOf(snapshot)}
      dms={dmChannelsOf(snapshot)}
      presence={presence}
      activeChannel={activeChannel}
      onSelect={onSelect}
    />
  );
}
