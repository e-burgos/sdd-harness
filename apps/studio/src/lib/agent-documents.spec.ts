import { describe, it, expect } from 'vitest';
import { getAgentGeneratedDocuments } from './agent-documents';

describe('getAgentGeneratedDocuments', () => {
  const ctx = {
    specId: 'spec-e-burgos-004-studio-gates-topology',
    cycleId: 'cycle-01',
  };

  it('returns spec, plan and cycle.json for orchestrator', () => {
    const docs = getAgentGeneratedDocuments('sdd-orchestrator', ctx);
    expect(docs.length).toBeGreaterThanOrEqual(3);
    expect(docs.some((d) => d.name.endsWith('.spec.md'))).toBe(true);
    expect(docs.some((d) => d.name === 'cycle.json')).toBe(true);
    expect(docs.some((d) => d.name === 'plan.md')).toBe(true);
  });

  it('returns tasks.json for planner', () => {
    const docs = getAgentGeneratedDocuments('sdd-planner', ctx);
    expect(docs.some((d) => d.name === 'tasks.json')).toBe(true);
  });

  it('returns gates.ts for architect in spec-004', () => {
    const docs = getAgentGeneratedDocuments('sdd-architect', ctx);
    expect(docs.some((d) => d.name === 'gates.ts')).toBe(true);
  });

  it('returns frontend components for implementor-front in spec-004', () => {
    const docs = getAgentGeneratedDocuments('sdd-implementor-front', ctx);
    expect(docs.some((d) => d.name === 'GateCard.tsx')).toBe(true);
    expect(docs.some((d) => d.name === 'GateInspectorDrawer.tsx')).toBe(true);
    expect(docs.some((d) => d.name === 'LiveAgentChatFeed.tsx')).toBe(true);
  });

  it('returns context update and reviewer report for reviewer', () => {
    const docs = getAgentGeneratedDocuments('sdd-reviewer', ctx);
    expect(docs.some((d) => d.type === 'context')).toBe(true);
    expect(docs.some((d) => d.type === 'review')).toBe(true);
  });

  it('returns fix document when fixId is provided', () => {
    const fixDocs = getAgentGeneratedDocuments('sdd-steward', {
      specId: 'spec-e-burgos-003-studio-mission-control',
      fixId: 'FIX-e-burgos-003-001',
    });
    expect(fixDocs.some((d) => d.type === 'fix')).toBe(true);
    expect(fixDocs.some((d) => d.name === 'FIX-e-burgos-003-001.md')).toBe(true);
  });
});
