import type { ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { deriveConversation, inferGateFromText, listConversations, referencesInText, resolveSelectedThreadId } from './conversation';
import { emptyThread, type ThreadState, type TimelineItem } from './store/timeline';

const info = (id: string, patch: Partial<ThreadInfo> = {}): ThreadInfo => ({
  id,
  channelId: 'general',
  title: id,
  agent: 'sdd-orchestrator',
  options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' },
  status: 'idle',
  createdAt: '2026-01-01T00:00:00Z',
  lastActivity: '2026-01-01T00:00:00Z',
  link: { target: { kind: 'none' }, source: 'legacy' },
  pendingCount: 0,
  ...patch,
});

const thread = (i: ThreadInfo | null, items: TimelineItem[] = []): ThreadState => ({ ...emptyThread(), info: i, items });
const author = (agent: string) => ({ agent, parentToolUseId: null });
const user = (seq: number, text: string): TimelineItem => ({ kind: 'user', id: `u${seq}`, seq, text });
const message = (seq: number, agent: string, text: string, done = true): TimelineItem => ({ kind: 'message', id: `m${seq}`, seq, author: author(agent), text, done });
const tool = (seq: number, agent: string, name: string, summary: string, status: 'running' | 'ok' = 'ok'): TimelineItem => ({ kind: 'tool', id: `t${seq}`, seq, author: author(agent), tool: name, summary, status });

const snapshot: WorkspaceSnapshot = {
  project: 'p',
  profile: 'team',
  kitVersion: null,
  gateMode: 'block',
  pricing: null,
  stale: [],
  agents: [],
  skills: [],
  specs: [{ id: 'spec-e-burgos-005-sessions', title: 'S', status: 'in-progress', folder: 'f', module: null, app: null, dependsOn: [] }],
  cycles: [],
  fixes: [{ id: 'FIX-e-burgos-003', title: 'F', status: 'closed', severity: null, specId: 'spec-e-burgos-005-sessions', createdAt: null, closedAt: null }],
};

describe('listConversations and resolveSelectedThreadId', () => {
  it('returns no conversations and null selection without threads', () => {
    expect(listConversations({})).toEqual([]);
    expect(resolveSelectedThreadId(null, {})).toBeNull();
    expect(resolveSelectedThreadId('x', {})).toBeNull();
  });

  it('ignores threads without info', () => {
    expect(listConversations({ a: thread(null) })).toEqual([]);
  });

  it('orders by most recent activity and defaults to the most recent', () => {
    const threads = {
      old: thread(info('old', { lastActivity: '2026-01-01T00:00:00Z' })),
      fresh: thread(info('fresh', { lastActivity: '2026-03-01T00:00:00Z' })),
    };
    expect(listConversations(threads).map((t) => t.id)).toEqual(['fresh', 'old']);
    expect(resolveSelectedThreadId(null, threads)).toBe('fresh');
  });

  it('keeps an explicit pick that exists and falls back when it does not', () => {
    const threads = { a: thread(info('a')), b: thread(info('b', { lastActivity: '2026-05-01T00:00:00Z' })) };
    expect(resolveSelectedThreadId('a', threads)).toBe('a');
    expect(resolveSelectedThreadId('gone', threads)).toBe('b');
  });

  it('breaks ties by creation then id', () => {
    const threads = {
      a: thread(info('a', { createdAt: '2026-01-01T00:00:00Z' })),
      b: thread(info('b', { createdAt: '2026-02-01T00:00:00Z' })),
      c: thread(info('c', { createdAt: '2026-02-01T00:00:00Z' })),
    };
    expect(listConversations(threads).map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('treats invalid dates as zero', () => {
    const threads = { bad: thread(info('bad', { lastActivity: 'nope' })), ok: thread(info('ok', { lastActivity: '2026-01-02T00:00:00Z' })) };
    expect(listConversations(threads)[0]?.id).toBe('ok');
  });
});

describe('referencesInText', () => {
  it('extracts spec ids with and without cycle', () => {
    expect(referencesInText('leer sdd/specs/spec-e-burgos-005-sessions/cycles/cycle-01/plan.md y sdd/specs/spec-x-1.')).toEqual({
      specs: [
        { specId: 'spec-e-burgos-005-sessions', cycle: 'cycle-01' },
        { specId: 'spec-x-1', cycle: null },
      ],
      fixes: [],
    });
  });

  it('ignores paths that are not specs', () => {
    expect(referencesInText('sdd/specs/index.json').specs).toEqual([]);
  });

  it('extracts fix ids and fix paths', () => {
    expect(referencesInText('ver FIX-e-burgos-003, y sdd/specs/s/fixes/fix-e-burgos-004.md').fixes).toEqual(['FIX-e-burgos-003', 'FIX-e-burgos-004']);
  });

  it('trims trailing punctuation', () => {
    expect(referencesInText('FIX-abc-.').fixes).toEqual(['FIX-abc']);
  });
});

describe('inferGateFromText', () => {
  it('maps known phrases and returns undefined otherwise', () => {
    expect(inferGateFromText('Regla cero')).toBe('regla-cero');
    expect(inferGateFromText('spec gate b')).toBe('gate-b');
    expect(inferGateFromText('hola')).toBeUndefined();
    expect(inferGateFromText(undefined)).toBeUndefined();
  });
});

describe('deriveConversation', () => {
  it('derives two conversations independently from their own events', () => {
    const a = thread(info('a'), [
      user(1, 'abrí sdd/specs/spec-e-burgos-005-sessions/cycles/cycle-01/brief.yaml'),
      message(2, 'sdd-planner', 'listo, ver FIX-e-burgos-003'),
    ]);
    const b = thread(info('b', { agent: 'sdd-architect' }), [user(1, 'leé sdd/specs/spec-other-9/cycles/cycle-02/x.md'), tool(2, 'sdd-architect', 'Read', 'sdd/specs/spec-other-9')]);
    const viewA = deriveConversation(a, snapshot);
    const viewB = deriveConversation(b, snapshot);
    expect(viewA.specs).toEqual([{ specId: 'spec-e-burgos-005-sessions', cycle: 'cycle-01', source: 'event', known: true }]);
    expect(viewA.fixes).toEqual([{ fixId: 'FIX-e-burgos-003', specId: 'spec-e-burgos-005-sessions', source: 'event', known: true }]);
    expect(viewA.participants).toEqual([
      { agentId: 'sdd-orchestrator', events: 1 },
      { agentId: 'sdd-planner', events: 1 },
    ]);
    expect(viewB.specs).toEqual([{ specId: 'spec-other-9', cycle: 'cycle-02', source: 'event', known: false }]);
    expect(viewB.fixes).toEqual([]);
    expect(viewB.participants.map((p) => p.agentId)).toEqual(['sdd-architect']);
  });

  it('reports an empty conversation without dialogues or participants', () => {
    const view = deriveConversation(thread(info('e')), snapshot);
    expect(view.isEmpty).toBe(true);
    expect(view.dialogues).toEqual([]);
    expect(view.participants).toEqual([]);
    expect(view.specs).toEqual([]);
  });

  it('adds link targets with source link and keeps event source when both exist', () => {
    const linked = thread(
      info('l', { link: { target: { kind: 'cycle', specId: 'spec-e-burgos-005-sessions', cycle: 'cycle-01' }, source: 'manual' } }),
    );
    expect(deriveConversation(linked, snapshot).specs).toEqual([{ specId: 'spec-e-burgos-005-sessions', cycle: 'cycle-01', source: 'link', known: true }]);

    const both = thread(info('l', { link: { target: { kind: 'cycle', specId: 'spec-e-burgos-005-sessions', cycle: 'cycle-01' }, source: 'manual' } }), [
      user(1, 'sdd/specs/spec-e-burgos-005-sessions'),
    ]);
    expect(deriveConversation(both, snapshot).specs[0]?.source).toBe('event');

    const fixLinked = thread(info('f', { link: { target: { kind: 'fix', fixId: 'FIX-zzz' }, source: 'manual' } }));
    expect(deriveConversation(fixLinked, snapshot).fixes).toEqual([{ fixId: 'FIX-zzz', specId: null, source: 'link', known: false }]);
  });

  it('canonicalizes case against the snapshot', () => {
    const view = deriveConversation(thread(info('c'), [user(1, 'sdd/specs/spec-E-Burgos-005-Sessions')]), snapshot);
    expect(view.specs[0]).toMatchObject({ specId: 'spec-e-burgos-005-sessions', known: true });
  });

  it('does not scan tool results or diffs', () => {
    const noisy: TimelineItem = { ...tool(1, 'a', 'Edit', 'x.ts'), diff: 'sdd/specs/spec-noise-1', result: 'FIX-noise' } as TimelineItem;
    const view = deriveConversation(thread(info('n'), [noisy]), snapshot);
    expect(view.specs).toEqual([]);
    expect(view.fixes).toEqual([]);
  });

  it('scans approval input', () => {
    const approval: TimelineItem = { kind: 'approval', id: 'ap', seq: 1, author: author('a'), tool: 'Write', summary: 'Write', input: 'sdd/specs/spec-in-1/cycles/cycle-03/x', decision: 'pending' };
    expect(deriveConversation(thread(info('p'), [approval]), null).specs).toEqual([{ specId: 'spec-in-1', cycle: 'cycle-03', source: 'event', known: false }]);
  });

  it('builds ordered dialogues without timestamps and with honest recipients', () => {
    const approval: TimelineItem = { kind: 'approval', id: 'ap', seq: 4, author: author('sdd-reviewer'), tool: 'Bash', summary: 'pnpm sdd:gate', decision: 'pending', gateWarning: 'spec gate b' };
    const subagent: TimelineItem = { kind: 'subagent', id: 'sa', seq: 5, agentType: 'sdd-planner', phase: 'start' };
    const items = [message(2, 'sdd-planner', 'hola', false), user(1, 'regla cero'), tool(3, 'sdd-planner', 'Read', 'a.md', 'running'), approval, subagent];
    const view = deriveConversation(thread(info('d'), items), null);
    expect(view.dialogues.map((d) => d.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(view.dialogues[0]).toMatchObject({ kind: 'user', from: 'user', to: 'sdd-orchestrator', gateId: 'regla-cero', isLive: false });
    expect(view.dialogues[1]).toMatchObject({ kind: 'message', to: 'user', isLive: true });
    expect(view.dialogues[2]).toMatchObject({ kind: 'tool', to: null, tool: 'Read', text: 'Read: a.md', isLive: true });
    expect(view.dialogues[3]).toMatchObject({ kind: 'approval', gateId: 'gate-b', isLive: true });
    expect(view.dialogues[4]).toMatchObject({ kind: 'subagent', to: 'sdd-planner' });
    expect(view.dialogues.every((d) => !('timestamp' in d))).toBe(true);
    expect(view.isEmpty).toBe(false);
  });

  it('skips usage and status items', () => {
    const status: TimelineItem = { kind: 'status', id: 's', seq: 1, status: 'idle' };
    expect(deriveConversation(thread(info('s'), [status]), null).isEmpty).toBe(true);
  });

  it('exposes session and provider exactly as received', () => {
    expect(deriveConversation(thread(info('a', { engineSessionId: 'abc', provider: 'claude' })), null)).toMatchObject({ engineSessionId: 'abc', provider: 'claude' });
    expect(deriveConversation(thread(info('a', { engineSessionId: null })), null).engineSessionId).toBeNull();
    expect(deriveConversation(thread(info('a')), null)).toMatchObject({ engineSessionId: undefined, provider: undefined });
  });

  it('adds the thread agent with zero events when only others spoke', () => {
    const view = deriveConversation(thread(info('x'), [message(1, 'sdd-planner', 'hi')]), null);
    expect(view.participants).toEqual([
      { agentId: 'sdd-planner', events: 1 },
      { agentId: 'sdd-orchestrator', events: 0 },
    ]);
  });
});
