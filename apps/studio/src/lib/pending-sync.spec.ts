import type { ThreadEvent } from '@sdd-studio/protocol';
import { bootstrap, openThread } from './bootstrap';
import { createStudioStore } from './store/store';

const snapshot = { project: 'p', profile: 'team', kitVersion: null, specs: [], cycles: [], fixes: [], agents: [], skills: [], gateMode: 'block', pricing: null, stale: [] };
const threadInfo = (pendingCount: number) => ({
  id: 't1', channelId: 'general', title: 'x', agent: 'sdd-orchestrator',
  options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' },
  status: 'running', createdAt: 'a', lastActivity: 'a', link: { target: { kind: 'none' }, source: 'legacy' }, pendingCount,
});

const history = (events: ThreadEvent[], from = 0) => events.map((event, i) => ({ seq: from + i, event }));
const pendingTexts = (store: ReturnType<typeof createStudioStore>) => store.getState().threads['t1']!.pending.map((p) => p.text);
const deliveredTexts = (store: ReturnType<typeof createStudioStore>) =>
  store.getState().threads['t1']!.items.flatMap((i) => (i.kind === 'user' && i.pendingId && !i.notDelivered ? [i.text] : []));

const events: ThreadEvent[] = [
  { type: 'user.message', text: 'inicio' },
  { type: 'pending.added', pendingId: 'p1', text: 'uno' },
  { type: 'pending.added', pendingId: 'p2', text: 'dos' },
  { type: 'user.message', text: 'uno', pendingId: 'p1', delivery: 'cut-point' },
];

describe('pending messages across reload, reconnect and tabs', () => {
  it('shows the real state of every message after a reload from the bridge history (CA-013.6)', async () => {
    const store = createStudioStore();
    store.getState().setThreads([threadInfo(1) as never]);
    await openThread({ request: async () => history(events) } as never, store, 't1');
    expect(pendingTexts(store)).toEqual(['dos']);
    expect(deliveredTexts(store)).toEqual(['uno']);
  });

  it('does not deliver or list twice what changed while the connection was lost (CA-015.4)', async () => {
    const store = createStudioStore();
    store.getState().setThreads([threadInfo(2) as never]);
    store.getState().loadHistory('t1', history(events.slice(0, 3)));
    expect(pendingTexts(store)).toEqual(['uno', 'dos']);

    const missed: ThreadEvent[] = [
      { type: 'user.message', text: 'uno', pendingId: 'p1', delivery: 'cut-point' },
      { type: 'pending.edited', pendingId: 'p2', text: 'dos editado' },
    ];
    const requests: unknown[] = [];
    const client = {
      request: async (cmd: { cmd: string; sinceSeq?: number }) => {
        requests.push(cmd);
        if (cmd.cmd === 'workspace.snapshot') return snapshot;
        if (cmd.cmd === 'thread.list') return [threadInfo(1)];
        if (cmd.cmd === 'presence.get') return [];
        return history(missed, 3);
      },
    };
    await bootstrap(client as never, store);
    expect(requests).toContainEqual({ cmd: 'thread.history', threadId: 't1', sinceSeq: 3 });
    expect(pendingTexts(store)).toEqual(['dos editado']);
    expect(deliveredTexts(store)).toEqual(['uno']);
    expect(store.getState().threads['t1']!.info?.pendingCount).toBe(1);
  });

  it('applies a live event replayed by the history only once', async () => {
    const store = createStudioStore();
    store.getState().setThreads([threadInfo(1) as never]);
    store.getState().loadHistory('t1', history(events.slice(0, 3)));
    store.getState().receive({ kind: 'thread.event', threadId: 't1', seq: 3, event: events[3]! });
    await openThread({ request: async () => history(events.slice(3), 3) } as never, store, 't1');
    expect(deliveredTexts(store)).toEqual(['uno']);
    expect(pendingTexts(store)).toEqual(['dos']);
  });

  it('mirrors in a second tab every pending change made in the first one (other tabs)', () => {
    const tabA = createStudioStore();
    const tabB = createStudioStore();
    for (const tab of [tabA, tabB]) tab.getState().loadHistory('t1', []);
    const stream: ThreadEvent[] = [
      { type: 'pending.added', pendingId: 'p1', text: 'uno' },
      { type: 'pending.edited', pendingId: 'p1', text: 'uno!' },
      { type: 'pending.added', pendingId: 'p2', text: 'dos' },
      { type: 'pending.removed', pendingId: 'p2' },
    ];
    stream.forEach((event, seq) => {
      for (const tab of [tabA, tabB]) tab.getState().receive({ kind: 'thread.event', threadId: 't1', seq, event });
    });
    expect(pendingTexts(tabA)).toEqual(['uno!']);
    expect(pendingTexts(tabB)).toEqual(pendingTexts(tabA));
  });

  it('keeps an interrupted thread with its pending messages visible and editable state (CA-015.2)', () => {
    const store = createStudioStore();
    store.getState().loadHistory('t1', history([
      { type: 'pending.added', pendingId: 'p1', text: 'uno' },
      { type: 'session.status', status: 'interrupted' },
    ]));
    expect(pendingTexts(store)).toEqual(['uno']);
  });
});
