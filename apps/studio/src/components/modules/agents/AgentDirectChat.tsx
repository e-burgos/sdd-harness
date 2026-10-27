'use client';

import { channelForDm } from '@sdd-studio/protocol';
import { MessageSquarePlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { agentMeta } from '@/lib/agents';
import { useT } from '@/lib/i18n/i18n';
import { threadsInChannel } from '@/lib/store/selectors';
import { useBridge, useStudio } from '../../BridgeProvider';
import { PanelNotice } from '../../shell/PanelNotice';
import { Composer } from '../../workspace/Composer';
import { ThreadView } from '../../workspace/ThreadView';

export function AgentDirectChat({ agentId, disabledReason }: { agentId: string; disabledReason?: string }) {
  const { t } = useT();
  const { connection } = useBridge();
  const channelId = channelForDm(agentId);
  const threads = useStudio((s) => s.threads);
  const latest = useMemo(() => threadsInChannel(threads, channelId)[0]?.id ?? null, [threads, channelId]);
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  const threadId = choice === undefined ? latest : choice;
  const reason = disabledReason ?? (connection.status === 'open' ? null : t('module.agents.chat.offline'));
  const name = agentMeta(agentId).name;

  const composer = (
    <Composer
      key={`${channelId}:${threadId ?? ''}`}
      channelId={channelId}
      threadId={threadId}
      onThreadCreated={(id) => setChoice(id)}
    />
  );

  return (
    <section data-testid="agent-direct-chat" aria-label={t('module.agents.chat.title')} className="flex min-h-0 flex-col border-t border-foreground/10 pt-2">
      <h3 className="flex h-7 items-center text-small font-medium text-ink-400">{t('module.agents.chat.title')}</h3>
      {reason ? (
        <div data-testid="agent-chat-disabled">
          <PanelNotice role="status" message={reason} />
        </div>
      ) : (
        <div data-studio-exempt="hosted-component" className="flex h-[26rem] min-h-0 flex-col overflow-hidden rounded-lg border border-foreground/10">
          {threadId ? (
            <ThreadView key={threadId} threadId={threadId} onBack={() => setChoice(null)} onNewConversation={() => setChoice(null)} composer={composer} />
          ) : (
            <>
              <div className="flex min-h-0 flex-1 flex-col items-start gap-2 px-3 py-3">
                <MessageSquarePlus aria-hidden size={16} className="text-ink-400" />
                <p className="text-ui text-ink-300">{t('module.agents.chat.empty', { name })}</p>
              </div>
              {composer}
            </>
          )}
        </div>
      )}
    </section>
  );
}
