'use client';

import { useState } from 'react';
import { Composer } from './Composer';
import { ChannelView } from './ChannelView';
import { RunOutput } from './RunOutput';
import { Sidebar } from './Sidebar';
import { ThreadView } from './ThreadView';

export interface View {
  channelId: string;
  threadId: string | null;
}

export function Workspace() {
  const [view, setView] = useState<View>({ channelId: 'general', threadId: null });
  const composer = (
    <>
      <RunOutput />
      <Composer
        key={`${view.channelId}:${view.threadId ?? ''}`}
        channelId={view.channelId}
        threadId={view.threadId}
        onThreadCreated={(threadId) => setView({ ...view, threadId })}
      />
    </>
  );
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_320px]">
      <Sidebar activeChannel={view.channelId} onSelect={(channelId) => setView({ channelId, threadId: null })} />
      <main className="min-h-0 min-w-0 overflow-hidden">
        {view.threadId ? (
          <ThreadView threadId={view.threadId} onBack={() => setView({ ...view, threadId: null })} composer={composer} />
        ) : (
          <ChannelView channelId={view.channelId} onOpenThread={(threadId) => setView({ ...view, threadId })} composer={composer} />
        )}
      </main>
      <aside aria-hidden className="min-h-0 overflow-y-auto border-l border-ink-800 bg-ink-900" />
    </div>
  );
}
