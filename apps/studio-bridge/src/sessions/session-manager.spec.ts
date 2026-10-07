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

  describe('state transitions and approvals', () => {
    interface Run {
      input: EngineTurnInput;
      cb: EngineCallbacks;
      ac: AbortController;
      finish: () => void;
    }
    /** Motor guionado: cada turno queda abierto hasta que el test lo termine; `onStart` puede lanzar. */
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
          if (input.text.includes('boom')) throw new Error('no se pudo arrancar');
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

      it('I2: thread scope on an mcp__ tool asks again', async () => {
        const { engine, runs } = scripted();
        const { m } = await manager(engine);
        const t = await m.createThread({ channelId: 'general', options: opts, text: 'x' });
        const ask = () => runs[0]!.cb.requestApproval({ ...req, toolName: 'mcp__srv__do', input: {} }, runs[0]!.ac.signal);
        const first = ask();
        m.respondApproval((await waitFor(() => pendingApproval(t.id))).approvalId, 'allow', undefined, 'thread');
        await first;
        sent.length = 0;
        void ask();
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
          type: 'approval.resolved', approvalId: (requested as { approvalId: string }).approvalId, decision: 'deny', reason: 'el puente se reinició',
        });
        expect(last2[1]).toMatchObject({ type: 'session.status', status: 'interrupted' });
        await m.interrupt(t.id);
      });
    });
  });
});
