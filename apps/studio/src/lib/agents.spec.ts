import { agentMeta, allKnownAgents } from './agents';

describe('agentMeta', () => {
  it('knows Clara as the orchestrator leader', () => {
    const clara = agentMeta('sdd-orchestrator');
    expect(clara.name).toBe('Clara');
    expect(clara.codename).toBe('Clara');
    expect(clara.role).toBe('Orchestrator');
    expect(clara.isLeader).toBe(true);
    expect(clara.color).toBe('#10b981');
  });

  it('knows the kit specialist agents', () => {
    const vulcan = agentMeta('sdd-implementor-back');
    expect(vulcan.name).toBe('Vulcan');
    expect(vulcan.role).toBe('Impl-back');
    expect(vulcan.color).toBe('#f59e0b');

    const aurora = agentMeta('sdd-implementor-front');
    expect(aurora.name).toBe('Aurora');
    expect(aurora.role).toBe('Impl-front');

    const sophia = agentMeta('sdd-functional');
    expect(sophia.name).toBe('Sophia');

    const chronos = agentMeta('sdd-planner');
    expect(chronos.name).toBe('Chronos');

    const daedalus = agentMeta('sdd-architect');
    expect(daedalus.name).toBe('Daedalus');

    const argus = agentMeta('sdd-reviewer');
    expect(argus.name).toBe('Argus');

    const jarvis = agentMeta('sdd-steward');
    expect(jarvis.name).toBe('Jarvis');

    const mercurio = agentMeta('sdd-hermes');
    expect(mercurio.name).toBe('Mercurio');
  });

  it('derives a friendly label for unknown custom agents', () => {
    expect(agentMeta('Explore')).toMatchObject({ id: 'Explore', name: 'Explore', short: 'EX', color: '#a1a1aa' });
    expect(agentMeta('sdd-custom')).toMatchObject({ name: 'Custom', short: 'CU' });
  });

  it('lists all known agents via allKnownAgents', () => {
    const list = allKnownAgents();
    expect(list.length).toBe(9);
    expect(list.find((a) => a.id === 'sdd-orchestrator')?.name).toBe('Clara');
  });
});
