import { describe, expect, it } from 'vitest';
import { AREAS, AgentSummary, FixSummary, SkillSummary, WorkspaceSnapshot } from './index';

const agent = { id: 'sdd-planner', description: 'd', model: null, source: 'sdd', path: 'sdd/agents/sdd-planner.agent.md' };
const skill = { id: 'sdd-planner', kind: 'skill', description: 'd', source: 'claude', path: '.claude/skills/x/SKILL.md' };
const fix = { id: 'FIX-001', title: 't', status: 'closed', severity: null, specId: null, createdAt: '2026-10-01', closedAt: null };

describe('catalog and fix summaries', () => {
  it('parses agents with source and path', () => {
    expect(AgentSummary.parse(agent)).toEqual(agent);
    expect(AgentSummary.safeParse({ ...agent, source: 'plugin' }).success).toBe(false);
    const { path, ...withoutPath } = agent;
    expect(path).toBeTruthy();
    expect(AgentSummary.safeParse(withoutPath).success).toBe(false);
  });
  it('parses skills and prompts and caps the description at 300', () => {
    expect(SkillSummary.parse(skill)).toEqual(skill);
    expect(SkillSummary.parse({ ...skill, kind: 'prompt' })).toMatchObject({ kind: 'prompt' });
    expect(SkillSummary.safeParse({ ...skill, description: 'x'.repeat(301) }).success).toBe(false);
    expect(SkillSummary.safeParse({ ...skill, id: '../x' }).success).toBe(false);
  });
  it('fixes carry nullable createdAt and closedAt', () => {
    expect(FixSummary.parse(fix)).toEqual(fix);
    expect(FixSummary.parse({ ...fix, createdAt: null })).toMatchObject({ createdAt: null });
    const { closedAt, ...withoutClosedAt } = fix;
    expect(closedAt).toBeNull();
    expect(FixSummary.safeParse(withoutClosedAt).success).toBe(false);
  });
});

describe('WorkspaceSnapshot v2', () => {
  const snapshot = {
    project: 'p', profile: 'team', kitVersion: null, specs: [], cycles: [], fixes: [fix],
    agents: [agent], skills: [skill], gateMode: 'warn', pricing: null, stale: [],
  };
  it('parses a snapshot with skills and rejects one without', () => {
    expect(WorkspaceSnapshot.parse(snapshot)).toEqual(snapshot);
    const { skills, ...withoutSkills } = snapshot;
    expect(skills).toHaveLength(1);
    expect(WorkspaceSnapshot.safeParse(withoutSkills).success).toBe(false);
  });
});

describe('WorkspaceSnapshot kit additions', () => {
  const snapshot = {
    project: 'p', profile: 'team', kitVersion: null, specs: [], cycles: [], fixes: [],
    agents: [], skills: [], gateMode: 'block', pricing: null, stale: [],
  };
  const tools = { status: 'ok', rtkEnabled: true, modEnabled: false, gate: 'block', modLinked: true, revision: 'a1b2c3d4e5f60718' };
  const cycle = { specId: 's', cycle: 'cycle-01', status: 'in-progress', flow: 'full', apps: [], tasks: [], tasksTotal: 0, tasksDone: 0 };
  const spec = { id: 's', title: 't', status: 'in-progress', folder: 'sdd/specs/s', module: null, app: null, dependsOn: [] };

  it('parses a v2 snapshot without any new field', () => {
    const parsed = WorkspaceSnapshot.parse({ ...snapshot, cycles: [cycle], specs: [spec], fixes: [fix] });
    expect(parsed.tools).toBeUndefined();
    expect(parsed.cycles[0]?.documents).toBeUndefined();
    expect(parsed.specs[0]?.document).toBeUndefined();
    expect(parsed.fixes[0]?.document).toBeUndefined();
  });
  it('parses tools, documents and document fields', () => {
    const parsed = WorkspaceSnapshot.parse({
      ...snapshot, tools,
      cycles: [{ ...cycle, documents: ['brief.yaml', 'artifacts/a.md'] }],
      specs: [{ ...spec, document: 'sdd/specs/s/s.spec.md' }],
      fixes: [{ ...fix, document: 'sdd/specs/s/fixes/f.md' }],
    });
    expect(parsed.tools).toEqual(tools);
    expect(parsed.cycles[0]?.documents).toEqual(['brief.yaml', 'artifacts/a.md']);
    expect(parsed.specs[0]?.document).toBe('sdd/specs/s/s.spec.md');
    expect(parsed.fixes[0]?.document).toBe('sdd/specs/s/fixes/f.md');
  });
  it('drops malformed new fields instead of failing the snapshot', () => {
    const parsed = WorkspaceSnapshot.parse({
      ...snapshot,
      tools: { status: 'weird' },
      cycles: [{ ...cycle, documents: 'brief.yaml' }],
      specs: [{ ...spec, document: 7 }],
      fixes: [{ ...fix, document: [] }],
    });
    expect(parsed.tools).toBeUndefined();
    expect(parsed.cycles[0]?.documents).toBeUndefined();
    expect(parsed.specs[0]?.document).toBeUndefined();
    expect(parsed.fixes[0]?.document).toBeUndefined();
  });
  it('caps documents at 64 entries', () => {
    const many = Array.from({ length: 65 }, (_, i) => `artifacts/${i}.md`);
    expect(WorkspaceSnapshot.parse({ ...snapshot, cycles: [{ ...cycle, documents: many }] }).cycles[0]?.documents).toBeUndefined();
  });
  it('parses live session bindings and leaves them undefined when absent or malformed', () => {
    const binding = {
      sessionId: 'studio-1', unit: { kind: 'cycle', specId: 's', cycle: 'cycle-01' }, harness: 'studio', source: 'studio',
      worktree: '/repo', boundAt: '2026-11-06T10:00:00.000Z', updatedAt: '2026-11-06T10:05:00.000Z',
    };
    const fixBinding = { ...binding, sessionId: 'claude-2', harness: 'claude-code', unit: { kind: 'fix', fixId: 'FIX-001' } };
    expect(WorkspaceSnapshot.parse(snapshot).sessions).toBeUndefined();
    expect(WorkspaceSnapshot.parse({ ...snapshot, sessions: [binding, fixBinding] }).sessions).toEqual([binding, fixBinding]);
    expect(WorkspaceSnapshot.parse({ ...snapshot, sessions: [{ ...binding, sessionId: 'a b' }] }).sessions).toBeUndefined();
    expect(WorkspaceSnapshot.parse({ ...snapshot, sessions: 'x' }).sessions).toBeUndefined();
  });
  it('keeps Area closed to the known values', () => {
    expect(AREAS).toEqual(['global', 'specs', 'fixes', 'agents', 'tools', 'pricing', 'kit']);
  });
});
