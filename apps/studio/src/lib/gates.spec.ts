import { describe, it, expect } from 'vitest';
import {
  SDD_GATES,
  CYCLE_GATES,
  TRANSVERSAL_GATES,
  ALL_GATES,
  getGateMeta,
  getGatesByGroup,
  getGatesForAgent,
} from './gates';

describe('SDD Gates Model', () => {
  it('defines exactly the 6 canonical SDD gates', () => {
    expect(ALL_GATES).toHaveLength(6);
    expect(CYCLE_GATES).toHaveLength(4);
    expect(TRANSVERSAL_GATES).toHaveLength(2);
  });

  it('retrieves individual gate metadata correctly', () => {
    const gateA = getGateMeta('gate-a');
    expect(gateA.name).toBe('SPEC GATE A');
    expect(gateA.group).toBe('cycle');
    expect(gateA.responsibleAgent).toBe('sdd-orchestrator');
    expect(gateA.rules.length).toBeGreaterThan(0);
  });

  it('filters gates by cycle or transversal group', () => {
    const cycleGates = getGatesByGroup('cycle');
    expect(cycleGates.map((g) => g.id)).toEqual(['gate-a', 'gate-b', 'contexto-gate', 'fix-gate']);

    const transversalGates = getGatesByGroup('transversal');
    expect(transversalGates.map((g) => g.id)).toEqual(['regla-cero', 'memoria-gate']);
  });

  it('identifies gates associated with a specific agent', () => {
    const claraGates = getGatesForAgent('sdd-orchestrator');
    expect(claraGates.some((g) => g.id === 'gate-a')).toBe(true);
    expect(claraGates.some((g) => g.id === 'contexto-gate')).toBe(true);

    const auroraGates = getGatesForAgent('sdd-implementor-front');
    expect(auroraGates.some((g) => g.id === 'gate-b')).toBe(true);
  });
});
