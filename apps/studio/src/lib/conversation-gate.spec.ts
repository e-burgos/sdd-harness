import type { ThreadInfo, WorkspaceSnapshot } from '@sdd-studio/protocol';
import { deriveConversation } from './conversation';
import { deriveConversationGate } from './conversation-gate';
import { emptyThread, type ThreadState, type TimelineItem } from './store/timeline';

const SPEC = 'spec-e-burgos-005-sessions';

const info: ThreadInfo = {
  id: 't',
  channelId: 'general',
  title: 't',
  agent: 'sdd-orchestrator',
  options: { agent: 'sdd-orchestrator', model: 'kit', effort: null, permissionMode: 'default' },
  status: 'idle',
  createdAt: '2026-01-01T00:00:00Z',
  lastActivity: '2026-01-01T00:00:00Z',
  link: { target: { kind: 'none' }, source: 'legacy' },
  pendingCount: 0,
};

const snapshot = (patch: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot => ({
  project: 'p',
  profile: 'team',
  kitVersion: null,
  gateMode: 'block',
  pricing: null,
  stale: [],
  agents: [],
  skills: [],
  specs: [{ id: SPEC, title: 'S', status: 'in-progress', folder: 'f', module: null, app: null, dependsOn: [] }],
  cycles: [],
  fixes: [
    { id: 'FIX-e-burgos-005-006', title: 'F', status: 'pending', severity: null, specId: SPEC, createdAt: null, closedAt: null },
    { id: 'FIX-e-burgos-005-001', title: 'F', status: 'closed', severity: null, specId: SPEC, createdAt: null, closedAt: null },
  ],
  ...patch,
});

const cycle = (status: string) => ({ specId: SPEC, cycle: 'cycle-02', status, flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0 });
const author = { agent: 'sdd-reviewer', parentToolUseId: null };
const write = (seq: number, summary: string, tool = 'Write'): TimelineItem => ({ kind: 'tool', id: `t${seq}`, seq, author, tool, summary, status: 'ok' });
const text = (seq: number, body: string): TimelineItem => ({ kind: 'user', id: `u${seq}`, seq, text: body });
const gateOf = (items: TimelineItem[], snap: WorkspaceSnapshot | null) => {
  const thread: ThreadState = { ...emptyThread(), info, items };
  return deriveConversationGate(deriveConversation(thread, snap), snap);
};

describe('deriveConversationGate', () => {
  it('is idle for an empty conversation', () => {
    expect(gateOf([], snapshot())).toEqual({ kind: 'idle' });
    expect(gateOf([], null)).toEqual({ kind: 'idle' });
  });

  it('follows the last written document: fix document gives FIX GATE', () => {
    const items = [write(1, `sdd/specs/${SPEC}/cycles/cycle-01/plan.md`), write(2, `sdd/specs/${SPEC}/fixes/fix-e-burgos-005-006.md`)];
    expect(gateOf(items, snapshot())).toEqual({ kind: 'fix', fixId: 'FIX-e-burgos-005-006' });
  });

  it('gives SPEC GATE with the cycle of the last written spec document, moving back when it is rewritten', () => {
    const items = [write(1, `sdd/specs/${SPEC}/fixes/fix-e-burgos-005-006.md`), write(2, `sdd/specs/${SPEC}/cycles/cycle-01/plan.md`)];
    expect(gateOf(items, snapshot())).toEqual({ kind: 'spec', specId: SPEC, cycle: 'cycle-01' });
    expect(gateOf([...items, write(3, `sdd/specs/${SPEC}/fixes/fix-e-burgos-005-006.md`, 'Edit')], snapshot())).toEqual({ kind: 'fix', fixId: 'FIX-e-burgos-005-006' });
  });

  it('uses the in-progress cycle of the spec when the written document has no cycle', () => {
    const snap = snapshot({ cycles: [cycle('in-progress')] });
    expect(gateOf([write(1, `sdd/specs/${SPEC}/${SPEC}.spec.md`)], snap)).toEqual({ kind: 'spec', specId: SPEC, cycle: 'cycle-02' });
    expect(gateOf([write(1, `sdd/specs/${SPEC}/${SPEC}.spec.md`)], snapshot())).toEqual({ kind: 'spec', specId: SPEC, cycle: null });
  });

  it('falls back to a mentioned fix that is pending or in progress, ignoring closed ones', () => {
    expect(gateOf([text(1, 'hay que hacer FIX-e-burgos-005-006')], snapshot())).toEqual({ kind: 'fix', fixId: 'FIX-e-burgos-005-006' });
    expect(gateOf([text(1, 'ya cerrado FIX-e-burgos-005-001')], snapshot())).toEqual({ kind: 'idle' });
  });

  it('uses the fix gate hint to accept a mentioned fix of any status', () => {
    expect(gateOf([text(1, 'FIX GATE: revisar FIX-e-burgos-005-001')], snapshot())).toEqual({ kind: 'fix', fixId: 'FIX-e-burgos-005-001' });
  });

  it('falls back to the in-progress cycle of a mentioned spec, not of unrelated specs', () => {
    const snap = snapshot({ cycles: [cycle('in-progress')] });
    expect(gateOf([text(1, `trabajamos en ${SPEC}`)], snap)).toEqual({ kind: 'spec', specId: SPEC, cycle: 'cycle-02' });
    expect(gateOf([text(1, 'hola')], snap)).toEqual({ kind: 'idle' });
    expect(gateOf([text(1, `trabajamos en ${SPEC}`)], snapshot({ cycles: [cycle('completed')] }))).toEqual({ kind: 'idle' });
  });

  it('follows the fix with the most recent activity, not the first document written', () => {
    const snap = snapshot({
      fixes: [
        { id: 'FIX-e-burgos-005-004', title: 'F', status: 'implemented', severity: null, specId: SPEC, createdAt: null, closedAt: null },
        { id: 'FIX-e-burgos-005-006', title: 'F', status: 'pending', severity: null, specId: SPEC, createdAt: null, closedAt: null },
        { id: 'FIX-e-burgos-005-007', title: 'F', status: 'pending', severity: null, specId: SPEC, createdAt: null, closedAt: null },
      ],
    });
    const items = [
      write(1, `sdd/specs/${SPEC}/fixes/fix-e-burgos-005-004.md`),
      text(2, 'registré FIX-e-burgos-005-006'),
      text(3, 'y también FIX-e-burgos-005-007'),
    ];
    expect(gateOf(items, snap)).toEqual({ kind: 'fix', fixId: 'FIX-e-burgos-005-007' });
  });

  it('keeps the written document when it is newer than every valid fix mention', () => {
    const items = [text(1, 'hay que hacer FIX-e-burgos-005-006'), write(2, `sdd/specs/${SPEC}/fixes/fix-e-burgos-005-001.md`)];
    expect(gateOf(items, snapshot())).toEqual({ kind: 'fix', fixId: 'FIX-e-burgos-005-001' });
  });

  it('prefers a newer written spec document over an older open fix mention', () => {
    const items = [text(1, 'hay que hacer FIX-e-burgos-005-006'), write(2, `sdd/specs/${SPEC}/cycles/cycle-01/plan.md`)];
    expect(gateOf(items, snapshot())).toEqual({ kind: 'spec', specId: SPEC, cycle: 'cycle-01' });
  });
});
