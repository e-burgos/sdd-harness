'use client';

import { channelForDm } from '@sdd-studio/protocol';
import { EmptyState } from '@e-burgos/tucu-ui';
import { MessageSquare } from 'lucide-react';
import { useMemo } from 'react';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { useNav } from '@/lib/nav/use-nav';
import { useStudio } from '../../BridgeProvider';
import { PanelRow } from '../../shell/PanelRow';
import { ThreadStatusChip } from '../../workspace/NavParts';

export function AgentsCenter() {
  const { t } = useT();
  const agentId = useNav((s) => s.selection.agents);
  const openHome = useNav((s) => s.openHome);
  const threads = useStudio((s) => s.threads);
  const conversations = useMemo(
    () =>
      Object.values(threads)
        .flatMap((thread) => (thread.info && agentId !== null && (thread.info.agent === agentId || thread.info.channelId === channelForDm(agentId)) ? [thread.info] : []))
        .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity)),
    [threads, agentId],
  );

  if (agentId === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState size="sm" title={t('module.agents.center.select')} description={t('module.agents.center.selectHint')} />
      </div>
    );
  }

  const name = agentMeta(agentId).name;
  return (
    <section data-testid="agent-conversations" className="flex h-full min-h-0 flex-col px-4 pt-4">
      <h2 className="flex h-7 shrink-0 items-center text-title font-semibold text-ink-100">{t('module.agents.center.conversations', { name })}</h2>
      {conversations.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState size="sm" icon={<MessageSquare aria-hidden size={16} />} title={t('module.agents.center.none', { name })} />
        </div>
      ) : (
        <ul className="mt-2 flex min-h-0 flex-1 flex-col gap-px overflow-y-auto pb-4">
          {conversations.map((info) => (
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
    </section>
  );
}
