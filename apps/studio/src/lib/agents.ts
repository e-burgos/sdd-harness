export interface AgentMeta {
  id: string;
  name: string;
  short: string;
  color: string;
}

const KNOWN: Record<string, Omit<AgentMeta, 'id'>> = {
  'sdd-orchestrator': { name: 'Orchestrator', short: 'OR', color: '#34d399' },
  'sdd-functional': { name: 'Functional', short: 'FN', color: '#60a5fa' },
  'sdd-planner': { name: 'Planner', short: 'PL', color: '#a78bfa' },
  'sdd-architect': { name: 'Architect', short: 'AR', color: '#f472b6' },
  'sdd-implementor-back': { name: 'Impl-back', short: 'IB', color: '#fbbf24' },
  'sdd-implementor-front': { name: 'Impl-front', short: 'IF', color: '#fb923c' },
  'sdd-reviewer': { name: 'Reviewer', short: 'RV', color: '#22d3ee' },
  'sdd-steward': { name: 'Steward', short: 'ST', color: '#94a3b8' },
};

export function agentMeta(id: string): AgentMeta {
  const known = KNOWN[id];
  if (known) return { id, ...known };
  const name = id.replace(/^sdd-/, '');
  return { id, name, short: name.slice(0, 2).toUpperCase(), color: '#a1a1aa' };
}
