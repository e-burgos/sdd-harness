import type { ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { deriveConversation, documentsOfAgent, inferGateFromText, listConversations, providerLabel, relatedFromDocuments, resolveSelectedThreadId } from './conversation';
import { emptyThread, type ThreadState, type TimelineItem, type TouchedDocument } from './store/timeline';

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

describe('inferGateFromText', () => {
  it('maps known phrases and returns undefined otherwise', () => {
    expect(inferGateFromText('Regla cero')).toBe('regla-cero');
    expect(inferGateFromText('spec gate b')).toBe('gate-b');
    expect(inferGateFromText('hola')).toBeUndefined();
    expect(inferGateFromText(undefined)).toBeUndefined();
  });
});

describe('deriveConversation', () => {
  it('derives two conversations independently from their own written documents', () => {
    const a = thread(info('a'), [
      tool(1, 'sdd-orchestrator', 'Write', '/repo/sdd/specs/spec-e-burgos-005-sessions/cycles/cycle-01/brief.yaml'),
      message(2, 'sdd-planner', 'listo, ver FIX-e-burgos-003'),
    ]);
    const b = thread(info('b', { agent: 'sdd-architect' }), [
      user(1, 'leé sdd/specs/spec-other-9/cycles/cycle-02/x.md'),
      tool(2, 'sdd-architect', 'Edit', 'sdd/specs/spec-other-9/cycles/cycle-02/x.md'),
    ]);
    const viewA = deriveConversation(a, snapshot);
    const viewB = deriveConversation(b, snapshot);
    expect(viewA.specs).toEqual([{ specId: 'spec-e-burgos-005-sessions', cycle: 'cycle-01', cycles: ['cycle-01'] }]);
    expect(viewA.fixes).toEqual([]);
    expect(viewA.participants).toEqual([
      { agentId: 'sdd-orchestrator', events: 1 },
      { agentId: 'sdd-planner', events: 1 },
    ]);
    expect(viewA.documents).toEqual([
      { path: 'sdd/specs/spec-e-burgos-005-sessions/cycles/cycle-01/brief.yaml', name: 'brief.yaml', specId: 'spec-e-burgos-005-sessions', fixId: null, cycle: 'cycle-01', agents: ['sdd-orchestrator'] },
    ]);
    expect(viewB.specs).toEqual([]);
    expect(viewB.documents).toEqual([]);
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

  it('does not list specs or fixes from link targets, reads or textual mentions', () => {
    const linked = thread(
      info('l', { link: { target: { kind: 'cycle', specId: 'spec-e-burgos-005-sessions', cycle: 'cycle-01' }, source: 'manual' } }),
      [
        tool(1, 'sdd-orchestrator', 'Read', 'sdd/specs/spec-e-burgos-005-sessions/cycles/cycle-01/plan.md'),
        message(2, 'sdd-planner', 'ver FIX-e-burgos-003 y sdd/specs/spec-e-burgos-005-sessions/plan.md'),
        tool(3, 'sdd-planner', 'Bash', '$ cat sdd/specs/spec-e-burgos-005-sessions/plan.md'),
      ],
    );
    const view = deriveConversation(linked, snapshot);
    expect(view.specs).toEqual([]);
    expect(view.fixes).toEqual([]);
    expect(view.documents).toEqual([]);
    const fixLinked = thread(info('f', { link: { target: { kind: 'fix', fixId: 'FIX-e-burgos-003' }, source: 'manual' } }));
    expect(deriveConversation(fixLinked, snapshot).fixes).toEqual([]);
  });

  it('canonicalizes case against the snapshot', () => {
    const view = deriveConversation(thread(info('c'), [tool(1, 'sdd-orchestrator', 'Edit', 'sdd/specs/spec-E-Burgos-005-Sessions/plan.md')]), snapshot);
    expect(view.specs[0]).toMatchObject({ specId: 'spec-e-burgos-005-sessions' });
  });

  it('does not scan tool results or diffs', () => {
    const noisy: TimelineItem = { ...tool(1, 'a', 'Edit', 'x.ts'), diff: 'sdd/specs/spec-noise-1', result: 'FIX-noise' } as TimelineItem;
    const view = deriveConversation(thread(info('n'), [noisy]), snapshot);
    expect(view.specs).toEqual([]);
    expect(view.fixes).toEqual([]);
  });

  it('discards documents of specs truncated or absent from the workspace snapshot', () => {
    const view = deriveConversation(
      thread(info('trunc'), [
        tool(1, 'sdd-orchestrator', 'Write', 'sdd/specs/spec-e-burgos-005-studi'),
        tool(2, 'sdd-orchestrator', 'Edit', 'sdd/specs/spec-e-b/cycles/cycle-01/plan.md'),
        tool(3, 'sdd-orchestrator', 'Edit', 'sdd/specs/spec-e-burgos/plan.md'),
        tool(4, 'sdd-orchestrator', 'Bash', '$ cat sdd/specs/spec-e-burgos-005-sessions/plan.md'),
      ]),
      snapshot,
    );
    expect(view.specs).toEqual([]);
    expect(view.fixes).toEqual([]);
    expect(view.documents).toEqual([]);
  });

  it('derives documents only from Write, Edit and MultiEdit, merging authors and linking fix documents', () => {
    const view = deriveConversation(
      thread(info('docs'), [
        tool(1, 'sdd-reviewer', 'Read', '/w/sdd/specs/spec-e-burgos-005-sessions/fixes/fix-e-burgos-003.md'),
        tool(2, 'sdd-reviewer', 'Edit', '/w/sdd/specs/spec-e-burgos-005-sessions/fixes/fix-e-burgos-003.md'),
        tool(3, 'sdd-planner', 'MultiEdit', '/w/sdd/specs/spec-e-burgos-005-sessions/fixes/fix-e-burgos-003.md'),
        tool(4, 'sdd-reviewer', 'Write', '/w/sdd/specs/spec-e-burgos-005-sessions/cycles/cycle-01/plan.md'),
        tool(5, 'sdd-reviewer', 'Grep', 'Grep sdd/specs/spec-e-burgos-005-sessions'),
        tool(6, 'sdd-reviewer', 'Read', '/w/sdd/specs/spec-e-burgos-005-sessions/cycles/cycle-01/brief.yaml'),
      ]),
      snapshot,
    );
    expect(view.documents).toEqual([
      { path: 'sdd/specs/spec-e-burgos-005-sessions/fixes/fix-e-burgos-003.md', name: 'fix-e-burgos-003.md', specId: 'spec-e-burgos-005-sessions', fixId: 'FIX-e-burgos-003', cycle: null, agents: ['sdd-reviewer', 'sdd-planner'] },
      { path: 'sdd/specs/spec-e-burgos-005-sessions/cycles/cycle-01/plan.md', name: 'plan.md', specId: 'spec-e-burgos-005-sessions', fixId: null, cycle: 'cycle-01', agents: ['sdd-reviewer'] },
    ]);
    expect(view.fixes).toEqual([{ fixId: 'FIX-e-burgos-003', specId: 'spec-e-burgos-005-sessions' }]);
    expect(view.specs).toEqual([{ specId: 'spec-e-burgos-005-sessions', cycle: 'cycle-01', cycles: ['cycle-01'] }]);
  });

  it('attributes a write to the subagent author, not to the thread agent', () => {
    const subagentWrite: TimelineItem = { kind: 'tool', id: 't1', seq: 1, author: { agent: 'sdd-implementor-front', parentToolUseId: 'toolu_parent' }, tool: 'Write', summary: 'sdd/specs/spec-e-burgos-005-sessions/plan.md', status: 'ok' };
    const view = deriveConversation(thread(info('sub'), [subagentWrite]), snapshot);
    expect(view.documents[0]?.agents).toEqual(['sdd-implementor-front']);
  });

  it('filters documents and derived specs and fixes by authoring agent', () => {
    const view = deriveConversation(
      thread(info('mix'), [
        tool(1, 'sdd-reviewer', 'Edit', 'sdd/specs/spec-e-burgos-005-sessions/fixes/fix-e-burgos-003.md'),
        tool(2, 'sdd-planner', 'Write', 'sdd/specs/spec-e-burgos-005-sessions/cycles/cycle-01/plan.md'),
      ]),
      snapshot,
    );
    const planner = documentsOfAgent(view.documents, 'sdd-planner');
    expect(planner.map((d) => d.name)).toEqual(['plan.md']);
    expect(relatedFromDocuments(planner)).toEqual({ specs: [{ specId: 'spec-e-burgos-005-sessions', cycle: 'cycle-01', cycles: ['cycle-01'] }], fixes: [] });
    expect(documentsOfAgent(view.documents, 'sdd-architect')).toEqual([]);
    expect(relatedFromDocuments([])).toEqual({ specs: [], fixes: [] });
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

describe('deriveConversation from Bash writes and mentions', () => {
  const root = 'sdd/specs/spec-e-burgos-005-sessions';

  it('derives documents from Bash heredocs, cd, variables and sed -i, grouped by cycle', () => {
    const view = deriveConversation(
      thread(info('bash'), [
        tool(1, 'sdd-orchestrator', 'Bash', `$ D=${root}/cycles/cycle-01 && mkdir -p $D && cat > $D/cycle.json <<'EOF'\n{}\nEOF`),
        tool(2, 'sdd-functional', 'Bash', `$ cd /w/${root}/cycles/cycle-02; cat > functional.md <<'…`),
        tool(3, 'sdd-architect', 'Bash', `$ sed -i '' 's/a/b/' ${root}/cycles/cycle-02/architect.md && pnpm sdd:validate`),
        tool(4, 'sdd-planner', 'Bash', `$ cat >> ${root}/fixes/fix-e-burgos-003.md <<'EOF'\nx\nEOF`),
        tool(5, 'sdd-planner', 'Bash', `$ cat ${root}/plan.md`),
      ]),
      snapshot,
    );
    expect(view.documents.map((d) => [d.name, d.cycle, d.agents[0]])).toEqual([
      ['cycle.json', 'cycle-01', 'sdd-orchestrator'],
      ['functional.md', 'cycle-02', 'sdd-functional'],
      ['architect.md', 'cycle-02', 'sdd-architect'],
      ['fix-e-burgos-003.md', null, 'sdd-planner'],
    ]);
    expect(view.specs).toEqual([{ specId: 'spec-e-burgos-005-sessions', cycle: 'cycle-02', cycles: ['cycle-01', 'cycle-02'] }]);
    expect(view.fixes).toEqual([{ fixId: 'FIX-e-burgos-003', specId: 'spec-e-burgos-005-sessions' }]);
  });

  it('discards Bash writes to specs absent from the snapshot or with unresolved paths', () => {
    const view = deriveConversation(
      thread(info('bash2'), [
        tool(1, 'a', 'Bash', '$ cat > sdd/specs/spec-unknown-1/plan.md <<EOF\nx\nEOF'),
        tool(2, 'a', 'Bash', `$ cat > $UNSET/plan.md; cd $(pwd); cat > ${root}/a.md`),
        tool(3, 'a', 'Bash', `$ cat > ${root}/cycles/cycle-01/pla…`),
      ]),
      snapshot,
    );
    expect(view.documents).toEqual([]);
  });

  it('collects mentions validated against the snapshot without creating specs, fixes or documents', () => {
    const view = deriveConversation(
      thread(info('m'), [
        user(1, 'mirá FIX-e-burgos-003 y spec-e-burgos-005-sessions'),
        message(2, 'sdd-planner', 'FIX-e-burgos-00… y spec-e-burgos-005-ses…'),
        tool(3, 'sdd-planner', 'Read', `${root}/plan.md`),
      ]),
      snapshot,
    );
    expect(view.mentions).toEqual({ specIds: ['spec-e-burgos-005-sessions'], fixIds: ['FIX-e-burgos-003'] });
    expect(view.specs).toEqual([]);
    expect(view.fixes).toEqual([]);
    expect(view.documents).toEqual([]);
  });

  it('reports no mentions without a snapshot', () => {
    expect(deriveConversation(thread(info('n'), [user(1, 'FIX-e-burgos-003')]), null).mentions).toEqual({ specIds: [], fixIds: [] });
  });
});

describe('providerLabel', () => {
  it('labels known providers and echoes unknown ones', () => {
    expect(providerLabel('claude')).toBe('Claude Code');
    expect(providerLabel('gemini')).toBe('gemini');
  });
});

describe('deriveConversation with document.touched (seq cutoff)', () => {
  const SPEC = 'spec-e-burgos-005-sessions';
  const doc = (name: string) => `sdd/specs/${SPEC}/${name}`;
  const touch = (seq: number, name: string, op: TouchedDocument['op'], agent = 'sdd-planner'): TouchedDocument => ({ seq, path: doc(name), op, author: author(agent) });
  const withTouched = (items: TimelineItem[], touched: TouchedDocument[]): ThreadState => ({ ...thread(info('t'), items), touched });

  it('uses only the heuristic when the thread has no structured touches', () => {
    const view = deriveConversation(withTouched([tool(1, 'sdd-planner', 'Write', doc('a.md'))], []), snapshot);
    expect(view.documents.map((d) => d.path)).toEqual([doc('a.md')]);
    expect(view.documents[0]?.op).toBeUndefined();
    expect(view.documentSource).toBe('heuristic');
  });

  it('uses the heuristic before the first touch and only touches after it', () => {
    const view = deriveConversation(
      withTouched(
        [
          tool(1, 'sdd-planner', 'Write', doc('before.md')),
          tool(5, 'sdd-planner', 'Write', doc('after-tool.md')),
        ],
        [touch(4, 'structured.md', 'created')],
      ),
      snapshot,
    );
    expect(view.documents.map((d) => d.path)).toEqual([doc('before.md'), doc('structured.md')]);
    expect(view.documents.map((d) => d.op)).toEqual([undefined, 'created']);
    expect(view.documentSource).toBe('mixed');
    expect(view.gateActivity.documentSeqs).toEqual({ [doc('before.md')]: 1, [doc('structured.md')]: 4 });
  });

  it('merges a path present in both stretches into a single record', () => {
    const view = deriveConversation(
      withTouched(
        [tool(1, 'sdd-reviewer', 'Edit', doc('shared.md')), tool(2, 'sdd-reviewer', 'Write', doc('other.md'))],
        [touch(6, 'shared.md', 'modified', 'sdd-planner')],
      ),
      snapshot,
    );
    expect(view.documents.map((d) => d.path)).toEqual([doc('other.md'), doc('shared.md')]);
    const shared = view.documents[1]!;
    expect(shared.agents).toEqual(['sdd-reviewer', 'sdd-planner']);
    expect(shared.op).toBe('modified');
    expect(view.gateActivity.documentSeqs[doc('shared.md')]).toBe(6);
  });

  it('reports structured when the thread only has touches', () => {
    const view = deriveConversation(
      withTouched([], [touch(2, 'a.md', 'created'), touch(3, 'a.md', 'deleted'), touch(4, 'b.md', 'modified')]),
      snapshot,
    );
    expect(view.documents.map((d) => [d.path, d.op])).toEqual([[doc('a.md'), 'deleted'], [doc('b.md'), 'modified']]);
    expect(view.documentSource).toBe('structured');
  });

  it('ignores touches outside known specs and keeps the source structured', () => {
    const view = deriveConversation(withTouched([], [{ seq: 1, path: 'README.md', op: 'modified', author: author('a') }]), snapshot);
    expect(view.documents).toEqual([]);
    expect(view.documentSource).toBe('structured');
  });

  it('exposes the session title exactly as received', () => {
    expect(deriveConversation(thread(info('t', { sessionTitle: 'Revisar' })), snapshot).sessionTitle).toBe('Revisar');
    expect(deriveConversation(thread(info('t', { sessionTitle: null })), snapshot).sessionTitle).toBeNull();
    expect(deriveConversation(thread(info('t')), snapshot).sessionTitle).toBeUndefined();
  });
});
