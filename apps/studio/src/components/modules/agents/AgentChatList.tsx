'use client';

import { channelForDm } from '@sdd-studio/protocol';
import { MessageSquare } from 'lucide-react';
import { useMemo } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { useBridge, useStudio } from '../../BridgeProvider';
import { PanelNotice } from '../../shell/PanelNotice';
import { PanelRow } from '../../shell/PanelRow';
import { Composer } from '../../workspace/Composer';
import { ThreadStatusChip } from '../../workspace/NavParts';

const MAX_RECENT = 5;

export function AgentChatList({ agentId, disabledReason }: { agentId: string; disabledReason?: string }) {
  const { t } = useT();
  const { connection } = useBridge();
  const openHome = useNav((s) => s.openHome);
  const channelId = channelForDm(agentId);
  const threads = useStudio((s) => s.threads);
  const recent = useMemo(
    () =>
      Object.values(threads)
        .flatMap((thread) => (thread.info && (thread.info.agent === agentId || thread.info.channelId === channelId) ? [thread.info] : []))
        .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
        .slice(0, MAX_RECENT),
    [threads, agentId, channelId],
  );
  const reason = disabledReason ?? (connection.status === 'open' ? null : t('module.agents.chat.offline'));

  return (
    <section data-testid="agent-direct-chat" aria-label={t('module.agents.chat.title')} className="flex min-h-0 flex-col border-t border-foreground/10 pt-2">
      <h3 className="flex h-7 items-center text-small font-medium text-ink-400">{t('module.agents.chat.title')}</h3>
      {reason ? (
        <div data-testid="agent-chat-disabled">
          <PanelNotice role="status" message={reason} />
        </div>
      ) : (
        <>
          {recent.length > 0 && (
            <ul data-testid="agent-recent-chats" className="flex flex-col gap-px">
              {recent.map((info) => (
                <li key={info.id}>
                  <PanelRow
                    label={info.title || info.id}
                    ariaLabel={t('module.agents.center.open', { title: info.title || info.id })}
                    icon={MessageSquare}
                    trailing={<ThreadStatusChip status={info.status} />}
                    meta={info.lastActivity.slice(0, 10)}
                    onClick={() => openHome({ kind: 'thread', threadId: info.id })}
                  />
                </li>
              ))}
            </ul>
          )}
          <div data-studio-exempt="hosted-component" className="mt-2 overflow-hidden rounded-lg border border-foreground/10">
            <Composer channelId={channelId} threadId={null} onThreadCreated={(id) => openHome({ kind: 'thread', threadId: id })} />
          </div>
        </>
      )}
    </section>
  );
}
