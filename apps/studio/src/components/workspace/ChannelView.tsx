'use client';

import { dmAgentOfChannel, specIdOfChannel } from '@sdd-studio/protocol';
import { useEffect, useMemo, type ReactNode } from 'react';
import { agentMeta } from '@/lib/agents';
import { loadBotHistory } from '@/lib/bootstrap';
import { botText } from '@/lib/format';
import { useT } from '@/lib/i18n/i18n';
import { cycleForChannel, threadsInChannel } from '@/lib/store/selectors';
import { useBridge, useStudio } from '../BridgeProvider';
import { AgentAvatar } from './AgentAvatar';
import { StatusBadge } from './StatusBadge';

export function ChannelView({ channelId, onOpenThread, composer }: { channelId: string; onOpenThread(id: string): void; composer: ReactNode }) {
  const { t } = useT();
  const { client, store, connection } = useBridge();
  const threads = useStudio((s) => s.threads);
  const snapshot = useStudio((s) => s.snapshot);
  const bot = useStudio((s) => s.bot[channelId]);
  const list = useMemo(() => threadsInChannel(threads, channelId), [threads, channelId]);
  const cycle = cycleForChannel(snapshot, channelId);
  const dmAgent = dmAgentOfChannel(channelId);
  const specId = specIdOfChannel(channelId);
  const spec = snapshot?.specs.find((s) => s.id === specId);

  useEffect(() => {
    if (connection.status === 'open' && !dmAgent) void loadBotHistory(client, store, channelId).catch(() => undefined);
  }, [client, store, channelId, connection.status, dmAgent]);

  return (
    <section className="flex h-full min-w-0 flex-col">
      <header className="flex items-center gap-3 border-b border-ink-800 px-5 py-3">
        <h1 className="truncate text-lg font-semibold">
          {dmAgent ? t('channel.dmWith', { name: agentMeta(dmAgent).name }) : `# ${spec?.id ?? channelId}`}
        </h1>
        {spec && <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[11px] text-ink-300">{spec.status}</span>}
        {cycle && (
          <div className="ml-auto flex items-center gap-2 text-xs text-ink-300">
            <span>{cycle.cycle} · {cycle.flow}</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-800">
              <div className="h-full bg-accent-400" style={{ width: `${cycle.tasksTotal ? (100 * cycle.tasksDone) / cycle.tasksTotal : 0}%` }} />
            </div>
            <span>{t('cycle.progress', { done: cycle.tasksDone, total: cycle.tasksTotal })}</span>
          </div>
        )}
      </header>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
        <section>
          <h2 className="mb-2 text-[11px] uppercase tracking-wider text-ink-500">{t('channel.threads')}</h2>
          {list.length === 0 && <p className="text-sm text-ink-300">{t('channel.noThreads')}</p>}
          <ul className="space-y-2">
            {list.map((thread) => (
              <li key={thread.id}>
                <button
                  className="flex w-full items-center gap-3 rounded-lg border border-ink-800 bg-ink-900 px-3 py-2 text-left hover:border-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
                  onClick={() => onOpenThread(thread.id)}
                >
                  <AgentAvatar agent={thread.agent} size={24} />
                  <span className="min-w-0 flex-1 truncate text-sm">{thread.title}</span>
                  <StatusBadge status={thread.status} />
                </button>
              </li>
            ))}
          </ul>
        </section>
        {!dmAgent && (bot?.length ?? 0) > 0 && (
          <section>
            <h2 className="mb-2 text-[11px] uppercase tracking-wider text-ink-500">{t('channel.bot')}</h2>
            <ul className="space-y-1 font-mono text-xs text-ink-300">
              {[...(bot ?? [])].reverse().map((e, i) => (
                <li key={`${e.botKind}:${i}`}><span aria-hidden>🤖</span> {botText(t, e)}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {composer}
    </section>
  );
}
