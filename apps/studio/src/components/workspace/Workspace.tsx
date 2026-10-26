'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/i18n';
import { usePanelState } from '@/lib/use-panel-state';
import { useBridge } from '../BridgeProvider';
import { Composer } from './Composer';
import { ChannelView } from './ChannelView';
import { PanelRail } from './PanelRail';
import { RightPanel } from './RightPanel';
import { RunOutput } from './RunOutput';
import { Sidebar } from './Sidebar';
import { ThreadView } from './ThreadView';

export interface View {
  channelId: string;
  threadId: string | null;
}

const RAIL_WIDTH = '44px';

export interface WorkspaceProps {
  selectedChannelId?: string;
  newConversationSignal?: number;
}

export function Workspace({ selectedChannelId, newConversationSignal = 0 }: WorkspaceProps = {}) {
  const { t } = useT();
  const { store } = useBridge();
  const panels = usePanelState();
  const [view, setView] = useState<View>({ channelId: selectedChannelId ?? 'general', threadId: null });

  useEffect(() => {
    if (selectedChannelId && selectedChannelId !== view.channelId) {
      setView({ channelId: selectedChannelId, threadId: null });
    }
  }, [selectedChannelId]);

  useEffect(() => {
    if (view.threadId) store.getState().selectThread(view.threadId);
  }, [store, view.threadId]);

  const startNewConversation = () => setView((v) => ({ channelId: v.channelId, threadId: null }));
  const lastSignal = useRef(newConversationSignal);
  useEffect(() => {
    if (newConversationSignal === lastSignal.current) return;
    lastSignal.current = newConversationSignal;
    startNewConversation();
  }, [newConversationSignal]);
  const composer = (
    <>
      <RunOutput />
      <Composer
        key={`${view.channelId}:${view.threadId ?? ''}`}
        channelId={view.channelId}
        threadId={view.threadId}
        onThreadCreated={(threadId) => setView((v) => (v.channelId === view.channelId ? { ...v, threadId } : v))}
      />
    </>
  );
  return (
    <div
      className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"
      style={{ gridTemplateColumns: `${panels.sidebarCollapsed ? RAIL_WIDTH : '260px'} minmax(0,1fr) ${panels.rightCollapsed ? RAIL_WIDTH : '320px'}` }}
    >
      {panels.sidebarCollapsed ? (
        <PanelRail side="left" label={t('panel.sidebar.expand')} onExpand={() => panels.setSidebarCollapsed(false)} />
      ) : (
        <Sidebar
          onCollapse={() => panels.setSidebarCollapsed(true)}
          view={view}
          onSelectChannel={(channelId) => setView({ channelId, threadId: null })}
          onOpenThread={(thread) => setView({ channelId: thread.channelId, threadId: thread.id })}
          onNewConversation={startNewConversation}
        />
      )}
      <main className="min-h-0 min-w-0 overflow-hidden">
        {view.threadId ? (
          <ThreadView key={view.threadId} threadId={view.threadId} onBack={() => setView({ ...view, threadId: null })} composer={composer} />
        ) : (
          <ChannelView channelId={view.channelId} onOpenThread={(threadId) => setView({ ...view, threadId })} composer={composer} />
        )}
      </main>
      {panels.rightCollapsed ? (
        <PanelRail side="right" label={t('panel.right.expand')} onExpand={() => panels.setRightCollapsed(false)} />
      ) : (
        <RightPanel
          onCollapse={() => panels.setRightCollapsed(true)}
          channelId={view.channelId}
          onOpenThread={(threadId) => {
            const channelId = store.getState().threads[threadId]?.info?.channelId ?? view.channelId;
            setView({ channelId, threadId });
          }}
        />
      )}
    </div>
  );
}
