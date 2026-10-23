import { defaultThreadOptions, type ServerEvent, type ThreadEvent, type WorkspaceSnapshot } from '@sdd-studio/protocol';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeEngine } from '../engine/fake-engine';
import type { AgentEngine, EngineCallbacks, EngineTurn, EngineTurnInput } from '../engine/types';
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
  it('runs DMs with the channel agent and rejects a mismatched agent', async () => {
    const { m } = await manager();
    const t = await m.createThread({ channelId: 'dm:sdd-planner', options: { ...opts, agent: 'sdd-planner' }, text: 'hola' });
    await waitFor(() => statusOf(m, t.id) === 'idle');
    expect(t.agent).toBe('sdd-planner');
    await expect(
      m.createThread({ channelId: 'dm:sdd-planner', options: opts, text: 'hola' }),
    ).rejects.toMatchObject({ code: 'bad-request' });
  });

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

  it('shares one write scope across all dm channels, but not with spec channels', async () => {
    const { m } = await manager();
    const a = await m.createThread({ channelId: 'dm:sdd-planner', options: { ...opts, agent: 'sdd-planner' }, text: '#slow' });
    const b = await m.createThread({ channelId: 'dm:sdd-architect', options: { ...opts, agent: 'sdd-architect' }, text: 'hola' });
    const c = await m.createThread({ channelId: 'spec:spec-dev-001-pagos', options: opts, text: '#slow' });
    expect(statusOf(m, a.id)).toBe('running');
    expect(statusOf(m, b.id)).toBe('queued');
    expect(statusOf(m, c.id)).toBe('running');
    await m.interrupt(a.id);
    await waitFor(() => statusOf(m, b.id) === 'idle');
    await m.interrupt(c.id);
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

  describe('state transitions and approvals', () => {
    interface Run {
      input: EngineTurnInput;
      cb: EngineCallbacks;
      ac: AbortController;
      finish: () => void;
    }
    /** Scripted engine: each turn stays open until the test ends it; `onStart` may throw. */
    function scripted(onStart?: (input: EngineTurnInput, n: number) => void) {
      const runs: Run[] = [];
      const engine: AgentEngine = {
        name: 'scripted',
        startTurn: (input, cb): EngineTurn => {
          onStart?.(input, runs.length);
          const ac = new AbortController();
          let finish!: () => void;
          const done = new Promise<void>((resolve) => (finish = resolve));
          runs.push({ input, cb, ac, finish });
          return { done, interrupt: async () => ac.abort() };
        },
      };
      return { engine, runs };
    }
    const req = { toolName: 'Bash', input: { command: 'ls' }, author: { agent: 'main', parentToolUseId: null }, toolUseId: null };

    it('does not leave the thread running when startTurn throws, and still starts the queued thread', async () => {
      const fake = new FakeEngine(1);
      const engine: AgentEngine = {
        name: 'throwing',
        startTurn: (input, cb) => {
          if (input.prompts[0]?.prompt.text.includes('boom')) throw new Error('no se pudo arrancar');
          return fake.startTurn(input, cb);
        },
      };
      const { m } = await manager(engine);
      const ch = 'general';
      const a = await m.createThread({ channelId: ch, options: opts, text: '#slow' });
      const b = await m.createThread({ channelId: ch, options: opts, text: 'boom' });
      const c = await m.createThread({ channelId: ch, options: opts, text: 'hola' });
      expect(statusOf(m, b.id)).toBe('queued');
      await m.interrupt(a.id);
      await waitFor(() => statusOf(m, c.id) === 'idle');
      expect(statusOf(m, b.id)).toBe('error');
      expect(eventsOf(b.id).filter((e) => e.type === 'session.status' && e.status === 'error')).toHaveLength(1);
    });

    it('marks error when startTurn throws synchronously on a direct send', async () => {
      const { engine } = scripted(() => {
        throw new Error('boom');
      });
      const { m } = await manager(engine);
      const t = await m.createThread({ channelId: 'general', options: opts, text: 'x' });
      expect(statusOf(m, t.id)).toBe('error');
    });

    it('starts queued writers in FIFO order, a late writer goes behind', async () => {
      const { m } = await manager();
      const ch = 'spec:spec-dev-001-pagos';
      const a = await m.createThread({ channelId: ch, options: opts, text: '#slow' });
      const b = await m.createThread({ channelId: ch, options: opts, text: '#slow' });
      await m.interrupt(a.id);
      const c = await m.createThread({ channelId: ch, options: opts, text: 'hola' });
      await waitFor(() => statusOf(m, b.id) === 'running');
      expect(statusOf(m, c.id)).toBe('queued');
      await m.interrupt(b.id);
      await waitFor(() => statusOf(m, c.id) === 'idle');
    });

    it('denies an approval requested after interrupt and keeps the thread interrupted', async () => {
      const { engine, runs } = scripted();
      const { m } = await manager(engine);
      const t = await m.createThread({ channelId: 'general', options: opts, text: 'x' });
      await m.interrupt(t.id);
      let decision: unknown;
      void runs[0]!.cb.requestApproval(req, runs[0]!.ac.signal).then((d) => (decision = d));
      await waitFor(() => decision);
      expect(decision).toEqual({ behavior: 'deny', message: 'interrupted' });
      expect(statusOf(m, t.id)).toBe('interrupted');
      runs[0]!.finish();
      await waitFor(() => runs.length > 0);
      expect(statusOf(m, t.id)).toBe('interrupted');
    });

    it('denies immediately when the signal is already aborted', async () => {
      const { engine, runs } = scripted();
      const { m } = await manager(engine);
      const t = await m.createThread({ channelId: 'general', options: opts, text: 'x' });
      const ac = new AbortController();
      ac.abort();
      let decision: unknown;
      void runs[0]!.cb.requestApproval(req, ac.signal).then((d) => (decision = d));
      await waitFor(() => decision);
      expect(decision).toMatchObject({ behavior: 'deny' });
      expect(statusOf(m, t.id)).toBe('running');
      runs[0]!.finish();
    });

    it('settles pending approvals when the turn ends', async () => {
      const { engine, runs } = scripted();
      const { m } = await manager(engine);
      const t = await m.createThread({ channelId: 'general', options: opts, text: 'uno' });
      let decision: unknown;
      void runs[0]!.cb.requestApproval(req, runs[0]!.ac.signal).then((d) => (decision = d));
      const pending = await waitFor(() => pendingApproval(t.id));
      expect(statusOf(m, t.id)).toBe('waiting-approval');
      runs[0]!.finish();
      await waitFor(() => statusOf(m, t.id) === 'idle');
      expect(decision).toEqual({ behavior: 'deny', message: 'turn ended' });
      expect(eventsOf(t.id)).toContainEqual({ type: 'approval.resolved', approvalId: pending.approvalId, decision: 'deny', reason: 'turn ended' });
      expect(() => m.respondApproval(pending.approvalId, 'allow', undefined, 'once')).toThrow(SessionError);
      await m.send(t.id, 'dos');
      expect(statusOf(m, t.id)).toBe('running');
      runs[1]!.finish();
      await waitFor(() => statusOf(m, t.id) === 'idle');
    });

    it('keeps the write mode frozen for a running turn when options change', async () => {
      const { m } = await manager();
      const ch = 'spec:spec-dev-001-pagos';
      const a = await m.createThread({ channelId: ch, options: opts, text: '#slow' });
      await m.setOptions(a.id, { permissionMode: 'plan' });
      const b = await m.createThread({ channelId: ch, options: opts, text: 'hola' });
      expect(statusOf(m, b.id)).toBe('queued');
      await m.interrupt(a.id);
      await waitFor(() => statusOf(m, b.id) === 'idle');
    });

    it('"always in this thread" never bypasses a SPEC GATE deny', async () => {
      const base = snapshot;
      snapshot = { ...base, gateMode: 'warn', cycles: [], fixes: [] };
      const { m } = await manager();
      const t = await m.createThread({ channelId: 'general', options: opts, text: '#edit' });
      m.respondApproval((await waitFor(() => pendingApproval(t.id))).approvalId, 'allow', undefined, 'thread');
      await waitFor(() => statusOf(m, t.id) === 'idle');
      snapshot = { ...base, cycles: base.cycles.map((c) => ({ ...c, status: 'completed' })), fixes: [] };
      sent.length = 0;
      await m.send(t.id, '#edit');
      await waitFor(() => statusOf(m, t.id) === 'idle');
      const resolved = eventsOf(t.id).find((e) => e.type === 'approval.resolved');
      expect(resolved).toMatchObject({ decision: 'deny' });
      expect(eventsOf(t.id).some((e) => e.type === 'tool.start')).toBe(false);
    });

    it('interrupting a queued thread keeps it interrupted and it never starts', async () => {
      const { m } = await manager();
      const ch = 'spec:spec-dev-001-pagos';
      const a = await m.createThread({ channelId: ch, options: opts, text: '#slow' });
      const b = await m.createThread({ channelId: ch, options: opts, text: 'hola' });
      await m.interrupt(b.id);
      expect(statusOf(m, b.id)).toBe('interrupted');
      await m.interrupt(a.id);
      await new Promise((r) => setTimeout(r, 150));
      expect(statusOf(m, b.id)).toBe('interrupted');
      expect(eventsOf(b.id).some((e) => e.type === 'turn.end')).toBe(false);
    });

    describe('final review fixes', () => {
      const acceptEdits = { ...opts, permissionMode: 'acceptEdits' as const };
      const gated = () => {
        snapshot = { ...snapshot, cycles: snapshot.cycles.map((c) => ({ ...c, status: 'completed' })), fixes: [] };
      };
      const approvalEvents = (id: string) => eventsOf(id).filter((e) => e.type.startsWith('approval.'));

      it('C1: acceptEdits edit without an active cycle is denied by the SPEC GATE with no tool', async () => {
        gated();
        const { m } = await manager();
        const t = await m.createThread({ channelId: 'general', options: acceptEdits, text: '#edit' });
        await waitFor(() => statusOf(m, t.id) === 'idle');
        expect(approvalEvents(t.id).map((e) => e.type)).toEqual(['approval.requested', 'approval.resolved']);
        expect(approvalEvents(t.id)[1]).toMatchObject({ decision: 'deny' });
        expect(eventsOf(t.id).some((e) => e.type === 'tool.start')).toBe(false);
      });

      it('C1: acceptEdits edit with an active cycle runs without an approval prompt', async () => {
        const { m } = await manager();
        const t = await m.createThread({ channelId: 'general', options: acceptEdits, text: '#edit' });
        await waitFor(() => statusOf(m, t.id) === 'idle');
        expect(eventsOf(t.id).some((e) => e.type === 'tool.start')).toBe(true);
        expect(approvalEvents(t.id)).toEqual([]);
      });

      it('C1: judgeTool classifies without emitting for allow/warn, and emits the deny pair for deny', async () => {
        const { engine, runs } = scripted();
        const { m } = await manager(engine);
        const t = await m.createThread({ channelId: 'general', options: acceptEdits, text: 'x' });
        const file = path.join(root, 'apps', 'x.ts');
        expect(runs[0]!.cb.judgeTool('Write', { file_path: file })).toEqual({ kind: 'allow' });
        expect(runs[0]!.cb.judgeTool('Bash', { command: 'ls' })).toEqual({ kind: 'allow' });
        expect(approvalEvents(t.id)).toEqual([]);
        gated();
        const verdict = runs[0]!.cb.judgeTool('Write', { file_path: file });
        expect(verdict).toMatchObject({ kind: 'deny' });
        expect(approvalEvents(t.id).map((e) => e.type)).toEqual(['approval.requested', 'approval.resolved']);
        runs[0]!.finish();
      });

      it('C1: requestApproval does not emit a second deny pair for a toolUseId the hook already denied', async () => {
        const { engine, runs } = scripted();
        const { m } = await manager(engine);
        const t = await m.createThread({ channelId: 'general', options: opts, text: 'x' });
        gated();
        const file = path.join(root, 'apps', 'x.ts');
        const ctx = { author: { agent: 'main', parentToolUseId: null }, toolUseId: 'tu-1' };
        runs[0]!.cb.judgeTool('Write', { file_path: file }, ctx);
        const decision = await runs[0]!.cb.requestApproval(
          { toolName: 'Write', input: { file_path: file }, author: ctx.author, toolUseId: 'tu-1' }, runs[0]!.ac.signal);
        expect(decision.behavior).toBe('deny');
        expect(approvalEvents(t.id)).toHaveLength(2);
        runs[0]!.finish();
      });

      it('C2: approval.requested carries the full Bash command in input', async () => {
        const { engine, runs } = scripted();
        const { m } = await manager(engine);
        const t = await m.createThread({ channelId: 'general', options: opts, text: 'x' });
        const command = `echo ${'a'.repeat(300)} && rm -rf /tmp/zzz`;
        void runs[0]!.cb.requestApproval({ ...req, input: { command } }, runs[0]!.ac.signal);
        const e = await waitFor(() => pendingApproval(t.id));
        expect(e.summary.length).toBeLessThanOrEqual(160);
        expect(JSON.parse(e.input ?? '')).toEqual({ command });
        expect(e.inputTruncated).toBeUndefined();
        await m.interrupt(t.id);
      });

      it('C2: input over 16 KB is capped and flagged inputTruncated', async () => {
        const { engine, runs } = scripted();
        const { m } = await manager(engine);
        const t = await m.createThread({ channelId: 'general', options: opts, text: 'x' });
        void runs[0]!.cb.requestApproval({ ...req, input: { command: 'b'.repeat(20_000) } }, runs[0]!.ac.signal);
        const e = await waitFor(() => pendingApproval(t.id));
        expect(e.input?.length).toBe(16_384);
        expect(e.inputTruncated).toBe(true);
        await m.interrupt(t.id);
      });

      it('C2: gate denies also carry the input', async () => {
        gated();
        const { m } = await manager();
        const t = await m.createThread({ channelId: 'general', options: opts, text: '#edit' });
        await waitFor(() => statusOf(m, t.id) === 'idle');
        expect(pendingApproval(t.id)?.input).toContain('file_path');
      });

      it('I2: always-allow on a Bash command only covers that exact command', async () => {
        const { engine, runs } = scripted();
        const { m } = await manager(engine);
        const t = await m.createThread({ channelId: 'general', options: opts, text: 'x' });
        const ask = (command: string) =>
          runs[0]!.cb.requestApproval({ ...req, input: { command } }, runs[0]!.ac.signal);
        const first = ask('ls');
        m.respondApproval((await waitFor(() => pendingApproval(t.id))).approvalId, 'allow', undefined, 'thread');
        await first;
        expect(await ask('ls')).toEqual({ behavior: 'allow' });
        sent.length = 0;
        void ask('rm -rf x');
        expect(await waitFor(() => pendingApproval(t.id))).toMatchObject({ tool: 'Bash' });
        await m.interrupt(t.id);
      });

      it('I2: thread scope on an mcp__ tool remembers only that tool, not the rest of the server', async () => {
        const { engine, runs } = scripted();
        const { m } = await manager(engine);
        const t = await m.createThread({ channelId: 'general', options: opts, text: 'x' });
        const ask = (toolName: string) => runs[0]!.cb.requestApproval({ ...req, toolName, input: {} }, runs[0]!.ac.signal);
        const first = ask('mcp__srv__do');
        m.respondApproval((await waitFor(() => pendingApproval(t.id))).approvalId, 'allow', undefined, 'thread');
        await first;
        expect(await ask('mcp__srv__do')).toEqual({ behavior: 'allow' });
        sent.length = 0;
        void ask('mcp__srv__other');
        await waitFor(() => pendingApproval(t.id));
        await m.interrupt(t.id);
      });

      it('M1: thread.updated is broadcast before the first thread.event', async () => {
        const { m } = await manager();
        const t = await m.createThread({ channelId: 'general', options: opts, text: 'hola' });
        const firstUpdated = sent.findIndex((e) => e.kind === 'thread.updated' && e.thread.id === t.id);
        const firstEvent = sent.findIndex((e) => e.kind === 'thread.event' && e.threadId === t.id);
        expect(firstUpdated).toBeGreaterThanOrEqual(0);
        expect(firstUpdated).toBeLessThan(firstEvent);
        await waitFor(() => statusOf(m, t.id) === 'idle');
      });

      it('M3: requestApproval refreshes the snapshot once before a gate deny is final', async () => {
        gated();
        const fresh = { ...snapshot, cycles: [{ ...snapshot.cycles[0]!, status: 'in-progress' }] };
        const store = new ThreadStore(root);
        await store.init();
        stores.push(store);
        const refresh = vi.fn(async () => {
          snapshot = fresh;
        });
        const { engine, runs } = scripted();
        const m = new SessionManager({
          root, engine, store, snapshot: () => snapshot, broadcast: (e) => sent.push(e), refreshSnapshot: refresh,
        });
        const t = await m.createThread({ channelId: 'general', options: opts, text: 'x' });
        const file = path.join(root, 'apps', 'x.ts');
        // Goes straight to requestApproval (the sync hook path cannot await the refresh and uses the debounced snapshot).
        void runs[0]!.cb.requestApproval({ ...req, toolName: 'Write', input: { file_path: file } }, runs[0]!.ac.signal);
        const e = await waitFor(() => pendingApproval(t.id));
        expect(e.gateWarning).toBeUndefined();
        expect(refresh).toHaveBeenCalledTimes(1);
        await m.interrupt(t.id);
      });
    });

    describe('restart recovery (I3)', () => {
      it('announces lost approvals and the interruption in the thread history', async () => {
        const { m, store } = await manager();
        const t = await m.createThread({ channelId: 'general', options: opts, text: '#tool' });
        await waitFor(() => pendingApproval(t.id));
        await store.flush();
        const store2 = new ThreadStore(root);
        await store2.init();
        stores.push(store2);
        expect(store2.recoveredThreadIds()).toEqual([t.id]);
        const m2 = new SessionManager({ root, engine: new FakeEngine(1), store: store2, snapshot: () => snapshot, broadcast: () => {} });
        await m2.recover();
        const hist = (await m2.history(t.id, 0)).map((h) => h.event);
        const requested = hist.find((e) => e.type === 'approval.requested');
        const last2 = hist.slice(-2);
        expect(last2[0]).toMatchObject({
          type: 'approval.resolved', approvalId: (requested as { approvalId: string }).approvalId, decision: 'deny', reason: 'the bridge restarted',
        });
        expect(last2[1]).toMatchObject({ type: 'session.status', status: 'interrupted' });
        await m.interrupt(t.id);
      });
    });
  });

  describe('pending messages', () => {
    const create = async (m: SessionManager, text: string) => {
      const t = await m.createThread({ channelId: 'general', options: opts, text });
      await waitFor(() => statusOf(m, t.id) === 'running' || statusOf(m, t.id) === 'waiting-approval');
      return t;
    };
    const settled = () => new Promise((r) => setTimeout(r, 30));
    const pendingCountOf = (m: SessionManager, id: string) => m.list().find((t) => t.id === id)?.pendingCount;
    const userMessages = (threadId: string) =>
      eventsOf(threadId).filter((e): e is Extract<ThreadEvent, { type: 'user.message' }> => e.type === 'user.message');
    const echoes = (threadId: string) =>
      eventsOf(threadId).flatMap((e) => (e.type === 'message.delta' ? [e.text] : []));

    it('adds a pending message while the thread is busy instead of throwing conflict', async () => {
      const { m } = await manager();
      const t = await create(m, '#slow');
      const result = await m.send(t.id, 'otra');
      expect(result).toEqual({ delivery: 'pending', pendingId: expect.any(String) });
      expect(eventsOf(t.id).filter((e) => e.type === 'pending.added')).toEqual([
        { type: 'pending.added', pendingId: (result as { pendingId: string }).pendingId, text: 'otra' },
      ]);
      expect(pendingCountOf(m, t.id)).toBe(1);
      await m.interrupt(t.id);
    });

    it('starts the turn as before when the thread is idle', async () => {
      const { m } = await manager();
      const t = await m.createThread({ channelId: 'general', options: opts, text: 'hola' });
      await waitFor(() => statusOf(m, t.id) === 'idle');
      expect(await m.send(t.id, 'otra')).toEqual({ delivery: 'started' });
      await waitFor(() => echoes(t.id).includes('echo: otra'));
    });

    it('delivers every pending message at the next cut point, in order', async () => {
      const { m } = await manager();
      const t = await create(m, '#steps:6');
      await m.send(t.id, 'first');
      await m.send(t.id, 'second');
      await waitFor(() => statusOf(m, t.id) === 'idle');
      const delivered = userMessages(t.id).filter((e) => e.pendingId);
      expect(delivered.map((e) => [e.text, e.delivery])).toEqual([['first', 'cut-point'], ['second', 'cut-point']]);
      expect(echoes(t.id)).toEqual(expect.arrayContaining(['heard: first', 'heard: second']));
      expect(pendingCountOf(m, t.id)).toBe(0);
    });

    it('does not deliver on approval resolution but at the end of the turn as next-turn', async () => {
      const { m } = await manager();
      const t = await m.createThread({ channelId: 'general', options: opts, text: '#tool' });
      const request = await waitFor(() => pendingApproval(t.id));
      await m.send(t.id, 'queued while waiting');
      m.respondApproval(request.approvalId, 'allow', undefined, 'once');
      await waitFor(() => statusOf(m, t.id) === 'idle');
      const delivered = userMessages(t.id).find((e) => e.pendingId);
      expect(delivered).toMatchObject({ text: 'queued while waiting', delivery: 'next-turn' });
      expect(echoes(t.id)).toContain('echo: queued while waiting');
    });

    it('edits and removes a message only while it is pending', async () => {
      const { m } = await manager();
      const t = await create(m, '#steps:6');
      const a = (await m.send(t.id, 'a')) as { pendingId: string };
      const b = (await m.send(t.id, 'b')) as { pendingId: string };
      m.editPending(t.id, a.pendingId, 'a2');
      m.removePending(t.id, b.pendingId);
      expect(eventsOf(t.id).map((e) => e.type)).toEqual(expect.arrayContaining(['pending.edited', 'pending.removed']));
      await waitFor(() => userMessages(t.id).some((e) => e.pendingId === a.pendingId));
      expect(userMessages(t.id).find((e) => e.pendingId === a.pendingId)?.text).toBe('a2');
      expect(() => m.editPending(t.id, a.pendingId, 'late')).toThrowError(new SessionError('conflict', 'already delivered'));
      expect(() => m.removePending(t.id, a.pendingId)).toThrowError(new SessionError('conflict', 'already delivered'));
      expect(() => m.removePending(t.id, 'nope')).toThrowError(expect.objectContaining({ code: 'not-found' }));
      await waitFor(() => statusOf(m, t.id) === 'idle');
    });

    it('rejects an empty edit and an 11th pending message', async () => {
      const { m } = await manager();
      const t = await create(m, '#slow');
      const first = (await m.send(t.id, 'm0')) as { pendingId: string };
      expect(() => m.editPending(t.id, first.pendingId, '  ')).toThrowError(expect.objectContaining({ code: 'bad-request' }));
      for (let i = 1; i < 10; i++) await m.send(t.id, `m${i}`);
      await expect(m.send(t.id, 'm10')).rejects.toMatchObject({ code: 'conflict', message: 'too many pending messages' });
      await m.interrupt(t.id);
    });

    it('keeps the pending messages after an interrupt and does not auto-send them', async () => {
      const { m } = await manager();
      const t = await create(m, '#slow');
      await m.send(t.id, 'kept');
      await m.interrupt(t.id);
      await waitFor(() => statusOf(m, t.id) === 'interrupted');
      await new Promise((r) => setTimeout(r, 30));
      expect(pendingCountOf(m, t.id)).toBe(1);
      expect(userMessages(t.id).some((e) => e.pendingId)).toBe(false);
    });

    it('does not auto-send pending messages after an engine failure', async () => {
      const { m } = await manager(new FakeEngine(1));
      const t = await m.createThread({ channelId: 'general', options: opts, text: '#fail' });
      const result = await m.send(t.id, 'after the failure').catch(() => null);
      await waitFor(() => statusOf(m, t.id) === 'error');
      await new Promise((r) => setTimeout(r, 30));
      if (result?.delivery === 'pending') expect(pendingCountOf(m, t.id)).toBe(1);
      expect(userMessages(t.id).some((e) => e.pendingId)).toBe(false);
    });

    it('sending to an interrupted thread delivers the pending ones first, then the new message', async () => {
      const { m } = await manager();
      const t = await create(m, '#slow');
      await m.send(t.id, 'p1');
      await m.send(t.id, 'p2');
      await m.interrupt(t.id);
      await waitFor(() => statusOf(m, t.id) === 'interrupted');
      await settled();
      expect(await m.send(t.id, 'new')).toEqual({ delivery: 'started' });
      await waitFor(() => echoes(t.id).includes('echo: p2'));
      const after = userMessages(t.id).slice(1);
      expect(after.map((e) => [e.text, e.pendingId ? e.delivery : 'direct'])).toEqual([
        ['p1', 'next-turn'], ['p2', 'next-turn'], ['new', 'direct'],
      ]);
      expect(pendingCountOf(m, t.id)).toBe(0);
    });

    it('flushPending starts a turn with the pending messages and conflicts when there is nothing to do', async () => {
      const { m } = await manager();
      const t = await create(m, '#slow');
      await m.send(t.id, 'p1');
      expect(() => m.flushPending(t.id)).toThrowError(expect.objectContaining({ code: 'conflict' }));
      await m.interrupt(t.id);
      await waitFor(() => statusOf(m, t.id) === 'interrupted');
      await settled();
      expect(m.flushPending(t.id)).toEqual({ delivery: 'started' });
      await waitFor(() => echoes(t.id).includes('echo: p1'));
      await waitFor(() => statusOf(m, t.id) === 'idle');
      expect(() => m.flushPending(t.id)).toThrowError(expect.objectContaining({ code: 'conflict', message: 'no pending messages' }));
    });

    it('reverts the batch the engine reports as undelivered on interrupt', async () => {
      const { m } = await manager();
      const t = await create(m, '#steps:20 #revert');
      await m.send(t.id, 'late');
      await waitFor(() => userMessages(t.id).some((e) => e.pendingId));
      await m.interrupt(t.id);
      const reverted = eventsOf(t.id).find((e) => e.type === 'pending.reverted');
      expect(reverted).toMatchObject({ reason: 'interrupt' });
      expect(pendingCountOf(m, t.id)).toBe(1);
      await waitFor(() => statusOf(m, t.id) === 'interrupted');
      expect(userMessages(t.id).filter((e) => e.pendingId)).toHaveLength(1);
    });

    it('starts a new turn from finish() when a message arrives after the engine ended its stream', async () => {
      const prompts: string[][] = [];
      let finishFirst!: () => void;
      const engine: AgentEngine = {
        name: 'late-end',
        startTurn: (input) => {
          prompts.push(input.prompts.map((p) => p.prompt.text));
          const first = prompts.length === 1;
          const done = first ? new Promise<void>((resolve) => (finishFirst = resolve)) : Promise.resolve();
          return { done, interrupt: async () => {} };
        },
      };
      const { m } = await manager(engine);
      const t = await m.createThread({ channelId: 'general', options: opts, text: 'first' });
      await m.send(t.id, 'raced');
      finishFirst();
      await waitFor(() => prompts.length === 2);
      expect(prompts[1]).toEqual(['raced']);
      expect(userMessages(t.id).find((e) => e.pendingId)).toMatchObject({ delivery: 'next-turn' });
    });

    it('reloads pending messages after a restart and does not send them', async () => {
      const first = await manager();
      const t = await create(first.m, '#slow');
      await first.m.send(t.id, 'survives');
      await first.store.flush();
      const started: string[] = [];
      const store = new ThreadStore(root);
      await store.init();
      stores.push(store);
      const m = new SessionManager({
        root, store, snapshot: () => snapshot, broadcast: (e) => sent.push(e),
        engine: { name: 'spy', startTurn: (input) => (started.push(input.threadId), new FakeEngine(1).startTurn(input, null as never)) },
      });
      await m.recover();
      expect(m.list().find((x) => x.id === t.id)).toMatchObject({ status: 'interrupted', pendingCount: 1 });
      await new Promise((r) => setTimeout(r, 20));
      expect(started).toEqual([]);
      await first.m.interrupt(t.id);
    });
  });

  describe('always rules', () => {
    const answer = async (m: SessionManager, threadId: string, scope: 'once' | 'thread') => {
      const request = await waitFor(() => pendingApproval(threadId));
      m.respondApproval(request.approvalId, 'allow', undefined, scope);
      return request;
    };
    const resolutions = (threadId: string) =>
      eventsOf(threadId).filter((e): e is Extract<ThreadEvent, { type: 'approval.resolved' }> => e.type === 'approval.resolved');
    const idle = (m: SessionManager, id: string) => waitFor(() => statusOf(m, id) === 'idle');
    const runAndAnswer = async (m: SessionManager, threadId: string, text: string, scope: 'once' | 'thread') => {
      sent.length = 0;
      await m.send(threadId, text);
      const request = await answer(m, threadId, scope);
      await idle(m, threadId);
      return request;
    };
    const runExpectingNoApproval = async (m: SessionManager, threadId: string, text: string) => {
      sent.length = 0;
      await m.send(threadId, text);
      await waitFor(() => statusOf(m, threadId) === 'running');
      await idle(m, threadId);
      expect(pendingApproval(threadId)).toBeUndefined();
      expect(eventsOf(threadId).some((e) => e.type === 'tool.start')).toBe(true);
    };
    const start = async (m: SessionManager, text: string) => {
      const t = await m.createThread({ channelId: 'general', options: opts, text });
      return t;
    };

    it('offers the rule in approval.requested and reports it as remembered in approval.resolved', async () => {
      const { m } = await manager();
      const t = await start(m, '#bash-git');
      const request = await answer(m, t.id, 'thread');
      await idle(m, t.id);
      expect(request.always).toEqual({ kind: 'bash-prefix', prefix: 'git status' });
      expect(resolutions(t.id)[0]).toMatchObject({ decision: 'allow', remembered: { kind: 'bash-prefix', prefix: 'git status' } });
    });

    it('a bash prefix rule auto-allows later commands with that prefix but not compound ones', async () => {
      const { m } = await manager();
      const t = await start(m, '#bash-git');
      await answer(m, t.id, 'thread');
      await idle(m, t.id);
      await runExpectingNoApproval(m, t.id, '#bash-git2');
      sent.length = 0;
      await m.send(t.id, '#bash-chain');
      const chained = await waitFor(() => pendingApproval(t.id));
      expect(chained.always).toEqual({ kind: 'none', reason: 'not-calculable' });
      await m.interrupt(t.id);
    });

    it('thread scope on a non-calculable command behaves as once and remembers nothing', async () => {
      const { m } = await manager();
      const t = await start(m, '#bash-chain');
      await answer(m, t.id, 'thread');
      await idle(m, t.id);
      expect(resolutions(t.id)[0]?.remembered).toBeUndefined();
      sent.length = 0;
      await m.send(t.id, '#bash-chain');
      await waitFor(() => pendingApproval(t.id));
      await m.interrupt(t.id);
    });

    it('remembers a mcp tool and an edit tool as tool rules', async () => {
      const { m } = await manager();
      const t = await start(m, '#mcp');
      await answer(m, t.id, 'thread');
      await idle(m, t.id);
      await runExpectingNoApproval(m, t.id, '#mcp');
      const edit = await runAndAnswer(m, t.id, '#edit-tool', 'thread');
      expect(edit.always).toEqual({ kind: 'tool', tool: 'Edit' });
      await runExpectingNoApproval(m, t.id, '#edit-tool');
    });

    it('the rule lives only with its thread', async () => {
      const { m } = await manager();
      const first = await start(m, '#mcp');
      await answer(m, first.id, 'thread');
      await idle(m, first.id);
      const second = await start(m, '#mcp');
      const request = await waitFor(() => pendingApproval(second.id));
      expect(request.always).toEqual({ kind: 'mcp', tool: 'mcp__fake__ping' });
      await m.interrupt(second.id);
    });

    it('a gate warning offers no Always, ignores scope thread and asks again next time', async () => {
      const base = snapshot;
      snapshot = { ...base, gateMode: 'warn', cycles: [], fixes: [] };
      const { m } = await manager();
      const t = await start(m, '#edit-tool');
      const request = await answer(m, t.id, 'thread');
      await idle(m, t.id);
      expect(request.gateWarning).toBeDefined();
      expect(request.always).toEqual({ kind: 'none', reason: 'gate-warning' });
      expect(resolutions(t.id)[0]?.remembered).toBeUndefined();
      sent.length = 0;
      await m.send(t.id, '#edit-tool');
      const again = await waitFor(() => pendingApproval(t.id));
      expect(again.gateWarning).toBeDefined();
      await m.interrupt(t.id);
    });

    it('a rule never bypasses a SPEC GATE deny or a later warning', async () => {
      const base = snapshot;
      const { m } = await manager();
      const t = await start(m, '#edit-tool');
      await answer(m, t.id, 'thread');
      await idle(m, t.id);
      snapshot = { ...base, cycles: base.cycles.map((c) => ({ ...c, status: 'completed' })), fixes: [] };
      sent.length = 0;
      await m.send(t.id, '#edit-tool');
      await idle(m, t.id);
      expect(resolutions(t.id)[0]).toMatchObject({ decision: 'deny' });
      expect(eventsOf(t.id).some((e) => e.type === 'tool.start')).toBe(false);
      snapshot = { ...base, gateMode: 'warn', cycles: [], fixes: [] };
      sent.length = 0;
      await m.send(t.id, '#edit-tool');
      const warned = await waitFor(() => pendingApproval(t.id));
      expect(warned.always).toEqual({ kind: 'none', reason: 'gate-warning' });
      await m.interrupt(t.id);
    });
  });

  describe('thread links', () => {
    const idleOf = (m: SessionManager, id: string) => waitFor(() => statusOf(m, id) === 'idle');
    const updates = (threadId: string) => sent.filter((e) => e.kind === 'thread.updated' && e.thread.id === threadId);

    it('auto-links a thread created in a spec channel to the in-progress cycle', async () => {
      const { m } = await manager();
      const t = await m.createThread({ channelId: 'spec:spec-dev-001-pagos', options: opts, text: 'hola' });
      expect(t.link).toEqual({ target: { kind: 'cycle', specId: 'spec-dev-001-pagos', cycle: 'cycle-01' }, source: 'auto' });
      await idleOf(m, t.id);
    });

    it('auto-links general threads to none and keeps the link in the listing', async () => {
      const { m } = await manager();
      const t = await m.createThread({ channelId: 'general', options: opts, text: 'hola' });
      expect(m.list().find((x) => x.id === t.id)?.link).toEqual({ target: { kind: 'none' }, source: 'auto' });
      await idleOf(m, t.id);
    });

    it('honors an explicit link as manual and rejects a missing destination without creating the thread', async () => {
      const { m } = await manager();
      const t = await m.createThread({ channelId: 'general', options: opts, text: 'hola', link: { kind: 'fix', fixId: 'FIX-dev-001-001' } });
      expect(t.link).toEqual({ target: { kind: 'fix', fixId: 'FIX-dev-001-001' }, source: 'manual' });
      await idleOf(m, t.id);
      const before = m.list().length;
      await expect(m.createThread({ channelId: 'general', options: opts, text: 'x', link: { kind: 'fix', fixId: 'FIX-nope' } })).rejects.toMatchObject({ code: 'not-found' });
      expect(m.list()).toHaveLength(before);
    });

    it('setLink reassigns manually, broadcasts thread.updated and persists', async () => {
      const { m, store } = await manager();
      const t = await m.createThread({ channelId: 'general', options: opts, text: 'hola' });
      await idleOf(m, t.id);
      sent.length = 0;
      const info = m.setLink(t.id, { kind: 'cycle', specId: 'spec-dev-001-pagos', cycle: 'cycle-01' });
      expect(info.link).toEqual({ target: { kind: 'cycle', specId: 'spec-dev-001-pagos', cycle: 'cycle-01' }, source: 'manual' });
      expect(updates(t.id)).toHaveLength(1);
      await store.flush();
      expect(store.get(t.id)?.link.source).toBe('manual');
      expect(m.setLink(t.id, { kind: 'none' }).link).toEqual({ target: { kind: 'none' }, source: 'manual' });
    });

    it('setLink keeps the previous link when the destination or the thread does not exist', async () => {
      const { m } = await manager();
      const t = await m.createThread({ channelId: 'general', options: opts, text: 'hola' });
      await idleOf(m, t.id);
      expect(() => m.setLink(t.id, { kind: 'fix', fixId: 'FIX-nope' })).toThrowError(expect.objectContaining({ code: 'not-found' }));
      expect(() => m.setLink('missing', { kind: 'none' })).toThrowError(expect.objectContaining({ code: 'not-found' }));
      expect(m.list().find((x) => x.id === t.id)?.link).toEqual({ target: { kind: 'none' }, source: 'auto' });
    });

    it('the link does not change the queue or the gate: a linked thread still shares the channel write scope', async () => {
      const { m } = await manager();
      const ch = 'spec:spec-dev-001-pagos';
      const a = await m.createThread({ channelId: ch, options: opts, text: '#slow' });
      const b = await m.createThread({ channelId: ch, options: opts, text: 'hola' });
      expect(statusOf(m, b.id)).toBe('queued');
      await m.interrupt(a.id);
      await idleOf(m, b.id);
    });
  });
});
