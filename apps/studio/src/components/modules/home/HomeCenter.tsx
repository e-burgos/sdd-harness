'use client';

import { useEffect } from 'react';
import type { PreparedConversation } from '@/lib/auto-conversation';
import { draftKey } from '@/lib/store/state';
import { useNav } from '@/lib/nav/use-nav';
import { useBridge, useStudio } from '../../BridgeProvider';
import { Composer } from '../../workspace/Composer';
import { PreparedConversations } from '../../workspace/PreparedConversations';
import { RunOutput } from '../../workspace/RunOutput';
import { ThreadView } from '../../workspace/ThreadView';
import { ChannelCenter } from './ChannelCenter';
import { InboxCenter } from './InboxCenter';

export function HomeCenter() {
  const { store } = useBridge();
  const home = useNav((s) => s.home);
  const setHome = useNav((s) => s.setHome);
  const threadId = home.kind === 'thread' ? home.threadId : null;
  const threadChannel = useStudio((s) => (threadId ? s.threads[threadId]?.info?.channelId : undefined));

  useEffect(() => {
    if (threadId) store.getState().selectThread(threadId);
  }, [store, threadId]);

  const openPrepared = (prepared: PreparedConversation, briefing: string) => {
    store.getState().openPrepared(prepared.id);
    store.getState().setDraftText(draftKey(prepared.channelId, null), briefing);
    setHome({ kind: 'channel', channelId: prepared.channelId });
  };

  const openThread = (id: string) => setHome({ kind: 'thread', threadId: id });
  const composerFor = (channelId: string, current: string | null) => (
    <>
      <RunOutput />
      <Composer
        key={`${channelId}:${current ?? ''}`}
        channelId={channelId}
        threadId={current}
        onThreadCreated={(id) => setHome({ kind: 'thread', threadId: id })}
      />
    </>
  );

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <PreparedConversations onOpen={openPrepared} />
      {home.kind === 'thread' ? (
        <ThreadView
          key={home.threadId}
          threadId={home.threadId}
          onBack={() => setHome({ kind: 'channel', channelId: threadChannel ?? 'general' })}
          composer={composerFor(threadChannel ?? 'general', home.threadId)}
          onNewConversation={() => setHome({ kind: 'channel', channelId: threadChannel ?? 'general' })}
        />
      ) : home.kind === 'inbox' ? (
        <InboxCenter which={home.which} onOpenThread={openThread} />
      ) : (
        <ChannelCenter
          key={home.kind === 'channel' ? home.channelId : 'specs'}
          target={home}
          composer={composerFor(home.kind === 'channel' ? home.channelId : 'general', null)}
          onOpenThread={openThread}
        />
      )}
    </div>
  );
}
