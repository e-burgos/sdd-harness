import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ThreadInfo } from '@sdd-studio/protocol';
import { BridgeContext } from '@/components/BridgeProvider';
import { createStudioStore } from './store/store';
import { useConversationSelection } from './use-conversation-selection';

const info = (id: string, lastActivity: string): ThreadInfo => ({
  id,
  channelId: 'general',
  title: id,
  agent: 'sdd-orchestrator',
  options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' },
  status: 'idle',
  createdAt: '2026-01-01T00:00:00Z',
  lastActivity,
  link: { target: { kind: 'none' }, source: 'legacy' },
  pendingCount: 0,
  engineSessionId: `session-of-${id}`,
  provider: 'claude',
});

function setup(list: ThreadInfo[]) {
  const store = createStudioStore();
  store.getState().setThreads(list);
  const request = vi.fn().mockResolvedValue([]);
  const value: any = { client: { request }, store, connection: { status: 'open' }, pairing: { port: 1, token: 't' }, syncError: null, retrySync: () => {} };
  const wrapper = ({ children }: { children: ReactNode }) => <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>;
  return { store, request, wrapper };
}

describe('useConversationSelection', () => {
  it('returns no selection and no view without threads', () => {
    const { wrapper } = setup([]);
    const { result } = renderHook(() => useConversationSelection(), { wrapper });
    expect(result.current.conversations).toEqual([]);
    expect(result.current.selectedThreadId).toBeNull();
    expect(result.current.view).toBeNull();
  });

  it('follows the most recent conversation and keeps an explicit pick', async () => {
    const { wrapper } = setup([info('old', '2026-01-01T00:00:00Z'), info('new', '2026-02-01T00:00:00Z')]);
    const { result } = renderHook(() => useConversationSelection(), { wrapper });
    expect(result.current.selectedThreadId).toBe('new');
    act(() => result.current.pick('old'));
    expect(result.current.selectedThreadId).toBe('old');
    expect(result.current.view?.engineSessionId).toBe('session-of-old');
    await waitFor(() => expect(result.current.view).not.toBeNull());
  });

  it('opens the selected thread when it is not synced', async () => {
    const { wrapper, request } = setup([info('a', '2026-01-01T00:00:00Z')]);
    renderHook(() => useConversationSelection(), { wrapper });
    await waitFor(() => expect(request).toHaveBeenCalledWith({ cmd: 'thread.history', threadId: 'a', sinceSeq: 0 }));
  });

  it('does not reopen a synced thread', async () => {
    const { wrapper, request, store } = setup([info('a', '2026-01-01T00:00:00Z')]);
    store.getState().loadHistory('a', []);
    renderHook(() => useConversationSelection(), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(request).not.toHaveBeenCalled();
  });
});
