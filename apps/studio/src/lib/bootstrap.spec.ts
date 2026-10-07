import { createStudioStore } from './store/store';
import { bootstrap, loadBotHistory, openThread } from './bootstrap';

const snapshot = { project: 'p', profile: 'team', kitVersion: null, specs: [], cycles: [], fixes: [], agents: [], gateMode: 'block', pricing: null, stale: [] };
const thread = { id: 't1', channelId: 'general', title: 'x', agent: 'sdd-orchestrator', options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' }, status: 'idle', createdAt: 'a', lastActivity: 'a' };

function fakeClient(responses: Record<string, unknown>) {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    request: async (cmd: Record<string, unknown>) => {
      calls.push(cmd);
      const r = responses[cmd.cmd as string];
      if (r instanceof Error) throw r;
      return r;
    },
  };
}

describe('bootstrap', () => {
  it('loads snapshot, threads and presence, validating them', async () => {
    const store = createStudioStore();
    const client = fakeClient({ 'workspace.snapshot': snapshot, 'thread.list': [thread], 'presence.get': [] });
    await bootstrap(client as never, store);
    expect(store.getState().snapshot?.project).toBe('p');
    expect(store.getState().threads.t1?.info?.title).toBe('x');
  });

  it('rejects malformed bridge data', async () => {
    const store = createStudioStore();
    const client = fakeClient({ 'workspace.snapshot': { nope: 1 }, 'thread.list': [], 'presence.get': [] });
    await expect(bootstrap(client as never, store)).rejects.toThrow();
  });

  it('asks only for events after the last known seq', async () => {
    const store = createStudioStore();
    store.getState().loadHistory('t1', [{ seq: 0, event: { type: 'user.message', text: 'a' } }]);
    const client = fakeClient({ 'thread.history': [{ seq: 1, event: { type: 'user.message', text: 'b' } }] });
    await openThread(client as never, store, 't1');
    expect(client.calls).toEqual([{ cmd: 'thread.history', threadId: 't1', sinceSeq: 1 }]);
    expect(store.getState().threads.t1?.items).toHaveLength(2);
  });

  it('re-syncs loaded threads on bootstrap after a reconnect', async () => {
    const store = createStudioStore();
    store.getState().loadHistory('t1', [{ seq: 0, event: { type: 'user.message', text: 'a' } }]);
    const client = fakeClient({ 'workspace.snapshot': snapshot, 'thread.list': [thread], 'presence.get': [], 'thread.history': [] });
    await bootstrap(client as never, store);
    expect(client.calls).toContainEqual({ cmd: 'thread.history', threadId: 't1', sinceSeq: 1 });
  });

  it('re-syncs synced threads even with no events yet (lastSeq -1)', async () => {
    const store = createStudioStore();
    store.getState().loadHistory('t1', []);
    expect(store.getState().threads.t1?.synced).toBe(true);
    const client = fakeClient({ 'workspace.snapshot': snapshot, 'thread.list': [thread], 'presence.get': [], 'thread.history': [] });
    await bootstrap(client as never, store);
    expect(client.calls).toContainEqual({ cmd: 'thread.history', threadId: 't1', sinceSeq: 0 });
  });

  it('does not lose a live event received between beginSync and loadHistory', async () => {
    const store = createStudioStore();
    const client = {
      request: async () => {
        store.getState().receive({ kind: 'thread.event', threadId: 't1', seq: 1, event: { type: 'user.message', text: 'live' } } as never);
        return [{ seq: 0, event: { type: 'user.message', text: 'old' } }];
      },
    };
    await openThread(client as never, store, 't1');
    expect(store.getState().threads.t1?.items).toHaveLength(2);
    expect(store.getState().threads.t1?.lastSeq).toBe(1);
  });

  it('leaves the thread unsynced when history fails', async () => {
    const store = createStudioStore();
    const client = fakeClient({ 'thread.history': new Error('boom') });
    await expect(openThread(client as never, store, 't1')).rejects.toThrow('boom');
    expect(store.getState().threads.t1?.synced).toBe(false);
  });

  it('loads bot history for a channel', async () => {
    const store = createStudioStore();
    const client = fakeClient({ 'channel.botHistory': [{ channelId: 'fixes', botKind: 'fix.created', payload: {} }] });
    await loadBotHistory(client as never, store, 'fixes');
    expect(client.calls).toEqual([{ cmd: 'channel.botHistory', channelId: 'fixes', limit: 100 }]);
    expect(store.getState().bot.fixes).toHaveLength(1);
  });

  it('buffers live events during reconnect so a gap is fetched', async () => {
    const store = createStudioStore();
    store.getState().loadHistory('t1', [0, 1, 2, 3, 4].map((seq) => ({ seq, event: { type: 'user.message' as const, text: `m${seq}` } })));
    const calls: Record<string, unknown>[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const client = {
      request: async (cmd: Record<string, unknown>) => {
        calls.push(cmd);
        if (cmd.cmd === 'workspace.snapshot') {
          await gate;
          return snapshot;
        }
        if (cmd.cmd === 'thread.list') return [thread];
        if (cmd.cmd === 'presence.get') return [];
        return [5, 6, 7, 8, 9].map((seq) => ({ seq, event: { type: 'user.message', text: `m${seq}` } }));
      },
    };
    const done = bootstrap(client as never, store);
    store.getState().receive({ kind: 'thread.event', threadId: 't1', seq: 10, event: { type: 'user.message', text: 'm10' } } as never);
    release();
    await done;
    expect(calls).toContainEqual({ cmd: 'thread.history', threadId: 't1', sinceSeq: 5 });
    expect(store.getState().threads.t1?.items.map((i) => (i as { text?: string }).text)).toEqual(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `m${n}`),
    );
  });
});
