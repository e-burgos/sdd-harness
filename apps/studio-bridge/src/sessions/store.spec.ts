import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defaultThreadOptions } from '@sdd-studio/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixture } from '../test-utils/fixture';
import { ThreadStore, toThreadInfo, type StoredThread } from './store';

let root: string;
let cleanup: () => Promise<void>;
beforeEach(async () => ({ root, cleanup } = await copyFixture()));
afterEach(() => cleanup());

const thread = (over: Partial<StoredThread> = {}): StoredThread => ({
  id: 't1', channelId: 'general', title: 'hola', agent: 'sdd-orchestrator', options: defaultThreadOptions(),
  status: 'idle', createdAt: '2026-10-07T00:00:00.000Z', lastActivity: '2026-10-07T00:00:00.000Z',
  engineSessionId: null, provider: 'claude', link: { target: { kind: 'none' }, source: 'legacy' }, pending: [], ...over,
});

describe('ThreadStore', () => {
  it('creates a self-ignoring .sdd-studio folder', async () => {
    await new ThreadStore(root).init();
    expect(await readFile(path.join(root, '.sdd-studio/.gitignore'), 'utf8')).toBe('*\n');
  });

  it('persists threads and events across instances', async () => {
    const a = new ThreadStore(root);
    await a.init();
    await a.upsert(thread({ engineSessionId: 'sess-1' }));
    expect(a.append('t1', { type: 'user.message', text: 'hola' })).toBe(0);
    expect(a.append('t1', { type: 'message.end', messageId: 'm' })).toBe(1);
    await a.flush();

    const b = new ThreadStore(root);
    await b.init();
    expect(b.get('t1')?.engineSessionId).toBe('sess-1');
    expect(await b.history('t1', 1)).toEqual([{ seq: 1, event: { type: 'message.end', messageId: 'm' } }]);
    expect(b.append('t1', { type: 'message.end', messageId: 'n' })).toBe(2);
  });

  it('marks busy threads as interrupted after a restart', async () => {
    const a = new ThreadStore(root);
    await a.init();
    await a.upsert(thread({ id: 'r', status: 'running' }));
    await a.upsert(thread({ id: 'w', status: 'waiting-approval' }));
    await a.upsert(thread({ id: 'q', status: 'queued' }));
    await a.flush();
    const b = new ThreadStore(root);
    await b.init();
    expect(b.list().map((t) => [t.id, t.status])).toEqual([['r', 'interrupted'], ['w', 'interrupted'], ['q', 'interrupted']]);
  });

  it('does not persist or return identical consecutive bot events, even across instances', async () => {
    const done = { channelId: 'spec:s1', botKind: 'task.status' as const, payload: { taskId: 'TASK-001', from: 'pending', to: 'done' } };
    const reopened = { ...done, payload: { ...done.payload, from: 'done', to: 'pending' } };
    const a = new ThreadStore(root);
    await a.init();
    a.appendBot(done);
    a.appendBot(done);
    a.appendBot(reopened);
    a.appendBot(done);
    await a.flush();
    const b = new ThreadStore(root);
    await b.init();
    b.appendBot(done);
    await b.flush();
    expect(await b.botHistory('spec:s1', 10)).toEqual([done, reopened, done]);
  });

  it('collapses duplicates already on disk when reading the history', async () => {
    const dir = path.join(root, '.sdd-studio', 'channels');
    await mkdir(dir, { recursive: true });
    const line = JSON.stringify({ channelId: 'fixes', botKind: 'fix.created', payload: { fixId: 'F1' } });
    await writeFile(path.join(dir, 'fixes.jsonl'), `${line}\n${line}\n`);
    const s = new ThreadStore(root);
    await s.init();
    expect(await s.botHistory('fixes', 10)).toHaveLength(1);
  });

  it('filters by channel and returns [] for unknown thread history', async () => {
    const s = new ThreadStore(root);
    await s.init();
    await s.upsert(thread({ id: 'a', channelId: 'fixes' }));
    await s.upsert(thread({ id: 'b', channelId: 'general' }));
    expect(s.list('fixes').map((t) => t.id)).toEqual(['a']);
    expect(await s.history('../../etc/passwd', 0)).toEqual([]);
  });

  it('keeps the last N bot events per channel', async () => {
    const s = new ThreadStore(root);
    await s.init();
    for (let i = 0; i < 5; i++) {
      s.appendBot({ channelId: 'spec:s1', botKind: 'task.status', payload: { i } });
    }
    expect((await s.botHistory('spec:s1', 2)).map((e) => e.payload.i)).toEqual([3, 4]);
    expect(await s.botHistory('fixes', 10)).toEqual([]);
  });

  it('round-trips bot history of a dm channel', async () => {
    const s = new ThreadStore(root);
    await s.init();
    s.appendBot({ channelId: 'dm:sdd-planner', botKind: 'task.status', payload: { i: 1 } });
    expect((await s.botHistory('dm:sdd-planner', 10)).map((e) => e.payload.i)).toEqual([1]);
  });

  it('handles disk errors without crashing on append', async () => {
    const errors: unknown[] = [];
    const s = new ThreadStore(root, (e) => errors.push(e));
    await s.init();
    await s.upsert(thread());
    await rm(path.join(root, '.sdd-studio/threads'), { recursive: true });
    s.append('t1', { type: 'message.end', messageId: 'm' });
    await s.flush();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('recovers from truncated lines and derives seq correctly', async () => {
    const s = new ThreadStore(root);
    await s.init();
    await s.upsert(thread());
    const threadFile = path.join(root, '.sdd-studio/threads/t1.jsonl');
    await writeFile(threadFile, '{"seq":0,"event":{"type":"user.message","text":"first"}}\n{"seq":1,"ev');
    const s2 = new ThreadStore(root);
    await s2.init();
    const nextSeq = s2.append('t1', { type: 'message.end', messageId: 'm' });
    expect(nextSeq).toBe(1);
    await s2.flush();
    const hist = await s2.history('t1', 0);
    expect(hist.map((e) => e.seq)).toEqual([0, 1]);
  });

  it('I1: refuses channel ids that would escape .sdd-studio/channels', async () => {
    const errors: unknown[] = [];
    const s = new ThreadStore(root, (e) => errors.push(e));
    await s.init();
    s.appendBot({ channelId: 'spec:x/../../escaped', botKind: 'task.status', payload: {} } as never);
    await s.flush();
    expect(errors.length).toBeGreaterThan(0);
    expect(await s.botHistory('spec:x/../../escaped', 10)).toEqual([]);
    await expect(readFile(path.join(root, '.sdd-studio', 'escaped.jsonl'), 'utf8')).rejects.toThrow();
    await expect(readFile(path.join(root, 'escaped.jsonl'), 'utf8')).rejects.toThrow();
  });

  it('I3: recoveredThreadIds lists threads that were busy before the restart', async () => {
    const a = new ThreadStore(root);
    await a.init();
    await a.upsert(thread({ id: 'r', status: 'running' }));
    await a.upsert(thread({ id: 'i', status: 'idle' }));
    await a.flush();
    const b = new ThreadStore(root);
    await b.init();
    expect(b.recoveredThreadIds()).toEqual(['r']);
  });

  it('I5: appends do not re-read the thread file (repair happens at init only)', async () => {
    const s = new ThreadStore(root);
    await s.init();
    await s.upsert(thread());
    for (let i = 0; i < 3; i++) s.append('t1', { type: 'message.end', messageId: `m${i}` });
    await s.flush();
    expect((await s.history('t1', 0)).map((e) => e.seq)).toEqual([0, 1, 2]);
  });

  it('I5: a channel file with a truncated last line is repaired once, before the first append', async () => {
    const file = path.join(root, '.sdd-studio/channels/fixes.jsonl');
    const s = new ThreadStore(root);
    await s.init();
    await writeFile(file, '{"channelId":"fixes","botKind":"a","payload":{"i":0}}\n{"channelId":"fix');
    s.appendBot({ channelId: 'fixes', botKind: 'task.status', payload: { i: 1 } });
    s.appendBot({ channelId: 'fixes', botKind: 'task.status', payload: { i: 2 } });
    expect((await s.botHistory('fixes', 10)).map((e) => e.payload.i)).toEqual([0, 1, 2]);
  });

  describe('migration and pending', () => {
    const writeThreadsJson = (threads: unknown[]) => writeFile(path.join(root, '.sdd-studio/threads.json'), JSON.stringify(threads));
    const legacyThread = () => {
      const { link: _link, pending: _pending, ...legacy } = thread();
      return legacy;
    };

    it('completes link as legacy/none and an empty pending list on a v1 threads.json', async () => {
      await new ThreadStore(root).init();
      await writeThreadsJson([legacyThread()]);
      const s = new ThreadStore(root);
      await s.init();
      expect(s.get('t1')?.link).toEqual({ target: { kind: 'none' }, source: 'legacy' });
      expect(s.get('t1')?.pending).toEqual([]);
    });

    it('drops a stored pendingCount: the count is always derived from pending', async () => {
      await new ThreadStore(root).init();
      await writeThreadsJson([{ ...legacyThread(), pendingCount: 7 }]);
      const s = new ThreadStore(root);
      await s.init();
      expect('pendingCount' in (s.get('t1') ?? {})).toBe(false);
      expect(toThreadInfo(s.get('t1') as StoredThread).pendingCount).toBe(0);
    });

    it('reloads pending messages after a restart without touching the thread status', async () => {
      const a = new ThreadStore(root);
      await a.init();
      await a.upsert(thread({ pending: [{ id: 'p-1', text: 'later', createdAt: '2026-10-07T00:00:01.000Z' }] }));
      await a.flush();
      const b = new ThreadStore(root);
      await b.init();
      expect(b.get('t1')?.pending).toEqual([{ id: 'p-1', text: 'later', createdAt: '2026-10-07T00:00:01.000Z' }]);
      expect(b.get('t1')?.status).toBe('idle');
    });

    it('toThreadInfo hides pending, exposes pendingCount and shows the engine session and provider (CA-006)', async () => {
      const info = toThreadInfo(thread({ engineSessionId: 's', pending: [{ id: 'p-1', text: 'x', createdAt: 'c' }] }));
      expect(info.pendingCount).toBe(1);
      expect('pending' in info).toBe(false);
      expect(info.engineSessionId).toBe('s');
      expect(info.provider).toBe('claude');
    });

    it('toThreadInfo reports a null session for a thread that has not started yet', async () => {
      expect(toThreadInfo(thread()).engineSessionId).toBeNull();
    });

    it('migrates a legacy threads.json without provider, keeping the engine session (CA-007)', async () => {
      await new ThreadStore(root).init();
      const { provider: _provider, ...withoutProvider } = thread({ engineSessionId: 'sess-old' });
      await writeThreadsJson([withoutProvider, { ...withoutProvider, id: 't2', engineSessionId: undefined }]);
      const s = new ThreadStore(root);
      await s.init();
      await s.flush();
      expect(s.get('t1')).toMatchObject({ provider: 'claude', engineSessionId: 'sess-old' });
      expect(s.get('t2')).toMatchObject({ provider: 'claude', engineSessionId: null });
      const rewritten = JSON.parse(await readFile(path.join(root, '.sdd-studio/threads.json'), 'utf8')) as StoredThread[];
      expect(rewritten.map((t) => t.provider)).toEqual(['claude', 'claude']);
    });

    it('is idempotent and keeps a valid provider', async () => {
      await new ThreadStore(root).init();
      await writeThreadsJson([thread({ provider: 'gemini', engineSessionId: 'g-1' })]);
      const first = new ThreadStore(root);
      await first.init();
      await first.flush();
      const second = new ThreadStore(root);
      await second.init();
      expect(second.get('t1')).toMatchObject({ provider: 'gemini', engineSessionId: 'g-1' });
    });

    it('replaces an invalid provider or empty session with defaults', async () => {
      await new ThreadStore(root).init();
      await writeThreadsJson([thread({ provider: 'Bad Provider', engineSessionId: '' })]);
      const s = new ThreadStore(root);
      await s.init();
      expect(s.get('t1')).toMatchObject({ provider: 'claude', engineSessionId: null });
    });
  });
});
