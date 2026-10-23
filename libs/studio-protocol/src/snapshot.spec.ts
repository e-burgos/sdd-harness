import { describe, expect, it } from 'vitest';
import { AgentSummary, FixSummary, SkillSummary, WorkspaceSnapshot } from './index';

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
