import type { BotEvent, ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { briefingFor, prepareFromBotEvent, preparedIdOf, preparedLabelOf, type PreparedConversation } from './auto-conversation';

const bot = (botKind: BotEvent['botKind'], payload: Record<string, unknown>, channelId = 'general'): BotEvent => ({ channelId, botKind, payload });
const options = { agent: 'sdd-orchestrator', model: 'kit' as const, effort: null, permissionMode: 'default' as const };
const thread = (link: ThreadInfo['link']): ThreadInfo => ({
  id: 't1', channelId: 'general', title: 't', agent: 'sdd-orchestrator', options, status: 'idle', createdAt: '1', lastActivity: '1', link, pendingCount: 0,
});
const snapshot = {
  project: 'p', profile: 'solo', kitVersion: null, gateMode: 'block', pricing: null, stale: [], skills: [], agents: [],
  specs: [], fixes: [{ id: 'FIX-a-001', title: 'Arreglo', status: 'pending', severity: null, specId: null, createdAt: null, closedAt: null }],
  cycles: [
    { specId: 'spec-a', cycle: 'cycle-01', status: 'in-progress', flow: 'lite', apps: ['apps/studio', 'libs/studio-protocol'], tasks: [], tasksTotal: 0, tasksDone: 0 },
    { specId: 'spec-b', cycle: 'cycle-02', status: 'in-progress', flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0 },
  ],
} as unknown as WorkspaceSnapshot;

describe('prepareFromBotEvent', () => {
  it('prepares a conversation in the spec channel for a new spec', () => {
    const [p] = prepareFromBotEvent(bot('spec.created', { specId: 'spec-a', title: 'A' }), [], []);
    expect(p).toMatchObject({ id: 'spec:spec-a', channelId: 'spec:spec-a', link: { kind: 'none' } });
  });

  it('prepares a cycle conversation linked to the cycle and drops the spec-level one', () => {
    const afterSpec = prepareFromBotEvent(bot('spec.created', { specId: 'spec-a' }), [], []);
    const afterCycle = prepareFromBotEvent(bot('cycle.opened', { specId: 'spec-a', cycle: 'cycle-01' }), [], afterSpec);
    expect(afterCycle.map((p) => p.id)).toEqual(['cycle:spec-a:cycle-01']);
    expect(afterCycle[0]).toMatchObject({ channelId: 'spec:spec-a', link: { kind: 'cycle', specId: 'spec-a', cycle: 'cycle-01' } });
  });

  it('prepares a fix conversation in the fixes channel linked to the fix', () => {
    const [p] = prepareFromBotEvent(bot('fix.created', { fixId: 'FIX-a-001', specId: null }, 'fixes'), [], []);
    expect(p).toMatchObject({ id: 'fix:FIX-a-001', channelId: 'fixes', link: { kind: 'fix', fixId: 'FIX-a-001' } });
  });

  it('ignores events that are not a new spec, cycle or fix, or that lack ids', () => {
    for (const event of [bot('spec.status', { specId: 'a' }), bot('cycle.status', { specId: 'a', cycle: 'c' }), bot('task.status', {}), bot('fix.status', { fixId: 'x' }), bot('cycle.opened', { specId: 'a' }), bot('fix.created', {})]) {
      expect(prepareFromBotEvent(event, [], [])).toEqual([]);
    }
  });

  it('does not prepare twice for the same target', () => {
    const once = prepareFromBotEvent(bot('cycle.opened', { specId: 'spec-a', cycle: 'cycle-01' }), [], []);
    expect(prepareFromBotEvent(bot('cycle.opened', { specId: 'spec-a', cycle: 'cycle-01' }), [], once)).toBe(once);
  });

  it('does not prepare when a conversation is already associated with the target', () => {
    const linked = thread({ target: { kind: 'none' }, source: 'auto', targets: [{ kind: 'cycle', specId: 'spec-a', cycle: 'cycle-01', origin: 'manual' }] });
    expect(prepareFromBotEvent(bot('cycle.opened', { specId: 'spec-a', cycle: 'cycle-01' }), [linked], [])).toEqual([]);
    expect(prepareFromBotEvent(bot('cycle.opened', { specId: 'spec-a', cycle: 'cycle-02' }), [linked], [])).toHaveLength(1);
  });
});

describe('briefingFor', () => {
  const prepared = (target: PreparedConversation['target']): PreparedConversation => ({ id: preparedIdOf(target), channelId: 'c', target, link: { kind: 'none' } });

  it('lists only the minimal files for a lite cycle and the subprojects it touches', () => {
    const text = briefingFor(prepared({ kind: 'cycle', specId: 'spec-a', cycle: 'cycle-01' }), snapshot);
    expect(text).toContain('Conversación nueva para spec-a, cycle-01.');
    expect(text).toContain('sdd/specs/spec-a/spec-a.spec.md');
    expect(text).toContain('sdd/specs/spec-a/cycles/cycle-01/plan.md');
    expect(text).not.toContain('functional.md');
    expect(text).toContain('sdd/context/apps/studio/context_prompt.md');
    expect(text).toContain('sdd/context/libs/studio-protocol/updates/*.md');
    expect(text).toContain('sdd/memory/lessons.md');
    expect(text).toContain('pnpm sdd:gate spec-a cycle-01');
  });

  it('lists the four documents of a full cycle', () => {
    const text = briefingFor(prepared({ kind: 'cycle', specId: 'spec-b', cycle: 'cycle-02' }), snapshot);
    for (const doc of ['brief.yaml', 'functional.md', 'planner.md', 'architect.md']) expect(text).toContain(doc);
    expect(text).not.toContain('plan.md');
  });

  it('points a new spec to the spec gate and the global context only', () => {
    const text = briefingFor(prepared({ kind: 'spec', specId: 'spec-a' }), snapshot);
    expect(text).toContain('pnpm sdd:gate spec-a.');
    expect(text).toContain('sdd/context/context_prompt.md');
    expect(text).not.toContain('cycles/');
  });

  it('points a fix to the fix gate with its title', () => {
    const text = briefingFor(prepared({ kind: 'fix', fixId: 'FIX-a-001', specId: null }), snapshot);
    expect(text).toContain('FIX-a-001 — Arreglo');
    expect(text).toContain('sdd/fixes.json');
    expect(text).toContain('hotfix-bypass-gate.prompt.md');
  });

  it('still produces a briefing without a snapshot', () => {
    expect(briefingFor(prepared({ kind: 'cycle', specId: 'spec-a', cycle: 'cycle-01' }), null)).toContain('sdd/memory/lessons.md');
  });
});

describe('labels', () => {
  it('labels each kind of target', () => {
    expect(preparedLabelOf({ kind: 'spec', specId: 's' })).toBe('s');
    expect(preparedLabelOf({ kind: 'cycle', specId: 's', cycle: 'cycle-01' })).toBe('s · cycle-01');
    expect(preparedLabelOf({ kind: 'fix', fixId: 'FIX-1', specId: null })).toBe('FIX-1');
  });
});
