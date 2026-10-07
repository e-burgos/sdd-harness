import { defaultThreadOptions, type ServerEvent, type ThreadEvent, type WorkspaceSnapshot } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeEngine } from '../engine/fake-engine';
import type { AgentEngine, EngineTurnInput } from '../engine/types';
import { copyFixture, waitFor } from '../test-utils/fixture';
import { loadWorkspaceSnapshot } from '../workspace/snapshot';
import { SessionError, SessionManager } from './session-manager';
import { ThreadStore } from './store';

let root: string;
let cleanup: () => Promise<void>;
let snapshot: WorkspaceSnapshot;
let sent: ServerEvent[];
let stores: ThreadStore[] = [];

beforeEach(async () => {
  ({ root, cleanup } = await copyFixture());
  snapshot = (await loadWorkspaceSnapshot(root)).snapshot;
  sent = [];
});
afterEach(async () => {
  await Promise.all(stores.map((s) => s.flush()));
  stores = [];
  await cleanup();
});

async function manager(engine: AgentEngine = new FakeEngine(1)) {
  const store = new ThreadStore(root);
  await store.init();
  stores.push(store);
  let n = 0;
  const m = new SessionManager({
    root, engine, store, snapshot: () => snapshot, broadcast: (e) => sent.push(e), newId: () => `id${++n}`,
  });
  return { m, store };
}
const eventsOf = (threadId: string): ThreadEvent[] =>
  sent.flatMap((e) => (e.kind === 'thread.event' && e.threadId === threadId ? [e.event] : []));
const statusOf = (m: SessionManager, id: string) => m.list().find((t) => t.id === id)?.status;
const pendingApproval = (threadId: string) =>
  eventsOf(threadId).find((e): e is Extract<ThreadEvent, { type: 'approval.requested' }> => e.type === 'approval.requested');
const opts = defaultThreadOptions();

describe('SessionManager', () => {
  it('runs a turn end to end and persists the history', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: 'hola' });
    await waitFor(() => statusOf(m, t.id) === 'idle');
    const types = eventsOf(t.id).map((e) => e.type);
    expect(types[0]).toBe('user.message');
    expect(types).toContain('turn.end');
    expect((await m.history(t.id, 0)).map((h) => h.event.type)).toEqual(types);
    expect(sent.some((e) => e.kind === 'presence.changed')).toBe(true);
  });

  it('waits for approval and runs the tool when allowed', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: '#tool' });
    const req = await waitFor(() => pendingApproval(t.id));
    expect(statusOf(m, t.id)).toBe('waiting-approval');
    m.respondApproval(req.approvalId, 'allow', undefined, 'once');
    await waitFor(() => statusOf(m, t.id) === 'idle');
    expect(eventsOf(t.id).some((e) => e.type === 'tool.start')).toBe(true);
  });

  it('sends the deny reason back and skips the tool', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: '#tool' });
    const req = await waitFor(() => pendingApproval(t.id));
    m.respondApproval(req.approvalId, 'deny', 'no toques eso', 'once');
    await waitFor(() => statusOf(m, t.id) === 'idle');
    expect(eventsOf(t.id)).toContainEqual({ type: 'approval.resolved', approvalId: req.approvalId, decision: 'deny', reason: 'no toques eso' });
    expect(eventsOf(t.id).some((e) => e.type === 'tool.start')).toBe(false);
  });

  it('remembers "always in this thread" approvals', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: '#tool' });
    m.respondApproval((await waitFor(() => pendingApproval(t.id))).approvalId, 'allow', undefined, 'thread');
    await waitFor(() => statusOf(m, t.id) === 'idle');
    sent.length = 0;
    await m.send(t.id, '#tool');
    await waitFor(() => statusOf(m, t.id) === 'idle' && eventsOf(t.id).some((e) => e.type === 'tool.start'));
    expect(pendingApproval(t.id)).toBeUndefined();
  });

  it('denies code edits through the SPEC GATE without asking', async () => {
    snapshot = { ...snapshot, cycles: snapshot.cycles.map((c) => ({ ...c, status: 'completed' })), fixes: [] };
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: '#edit' });
    await waitFor(() => statusOf(m, t.id) === 'idle');
    const resolved = eventsOf(t.id).find((e) => e.type === 'approval.resolved');
    expect(resolved).toMatchObject({ decision: 'deny' });
    expect(resolved?.type === 'approval.resolved' && resolved.reason).toContain('SPEC GATE');
    expect(sent.some((e) => e.kind === 'thread.updated' && e.thread.status === 'waiting-approval')).toBe(false);
  });

  it('asks with a gate warning in warn mode', async () => {
    snapshot = { ...snapshot, gateMode: 'warn', cycles: [], fixes: [] };
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: '#edit' });
    expect((await waitFor(() => pendingApproval(t.id))).gateWarning).toContain('SPEC GATE');
  });

  it('queues a second writing thread in the same channel and starts it after the first', async () => {
    const { m } = await manager();
    const a = await m.createThread({ channelId: 'spec:spec-dev-001-pagos', options: opts, text: '#slow' });
    const b = await m.createThread({ channelId: 'spec:spec-dev-001-pagos', options: opts, text: 'hola' });
    const c = await m.createThread({ channelId: 'spec:spec-dev-002-borrador', options: opts, text: '#slow' });
    const d = await m.createThread({ channelId: 'spec:spec-dev-001-pagos', options: { ...opts, permissionMode: 'plan' }, text: '#slow' });
    expect(statusOf(m, b.id)).toBe('queued');
    expect(statusOf(m, c.id)).toBe('running');
    expect(statusOf(m, d.id)).toBe('running');
    await m.interrupt(a.id);
    await waitFor(() => statusOf(m, b.id) === 'idle');
    expect(statusOf(m, a.id)).toBe('interrupted');
    await m.interrupt(c.id);
    await m.interrupt(d.id);
  });

  it('rejects a send while the thread is busy', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: '#slow' });
    await expect(m.send(t.id, 'otra')).rejects.toMatchObject({ code: 'conflict' });
    await m.interrupt(t.id);
  });

  it('interrupting a thread denies its pending approval', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: '#tool' });
    const req = await waitFor(() => pendingApproval(t.id));
    await m.interrupt(t.id);
    await waitFor(() => eventsOf(t.id).some((e) => e.type === 'approval.resolved'));
    expect(eventsOf(t.id)).toContainEqual({ type: 'approval.resolved', approvalId: req.approvalId, decision: 'deny', reason: 'interrupted' });
    expect(statusOf(m, t.id)).toBe('interrupted');
  });

  it('marks the thread as error when the engine fails', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: '#fail' });
    await waitFor(() => statusOf(m, t.id) === 'error');
    expect(eventsOf(t.id).at(-1)).toMatchObject({ type: 'session.status', status: 'error' });
  });

  it('resumes with the stored engine session id, also after a restart', async () => {
    const inputs: EngineTurnInput[] = [];
    const spy: AgentEngine = {
      name: 'spy',
      startTurn: (input, cb) => {
        inputs.push(input);
        cb.onSessionId('sess-42');
        return { done: Promise.resolve(), interrupt: async () => {} };
      },
    };
    const first = await manager(spy);
    const t = await first.m.createThread({ channelId: 'general', options: opts, text: 'uno' });
    await waitFor(() => statusOf(first.m, t.id) === 'idle');
    await first.store.flush();
    const second = await manager(spy);
    await second.m.send(t.id, 'dos');
    expect(inputs.map((i) => i.resumeSessionId)).toEqual([null, 'sess-42']);
    await waitFor(() => statusOf(second.m, t.id) === 'idle');
  });

  it('applies option changes without touching the agent', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'general', options: opts, text: 'hola' });
    await waitFor(() => statusOf(m, t.id) === 'idle');
    const updated = await m.setOptions(t.id, { model: 'opus', effort: 'high' });
    expect(updated.options).toEqual({ ...opts, model: 'opus', effort: 'high' });
  });

  it('reports unknown threads and approvals as not-found', async () => {
    const { m } = await manager();
    await expect(m.send('nope', 'x')).rejects.toBeInstanceOf(SessionError);
    expect(() => m.respondApproval('nope', 'allow', undefined, 'once')).toThrow(SessionError);
  });
});
