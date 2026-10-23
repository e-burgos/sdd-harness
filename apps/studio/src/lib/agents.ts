export interface AgentMeta {
  id: string;
  name: string;
  codename: string;
  title: string;
  short: string;
  role: string;
  color: string;
  accentGlow: string;
  personality: string;
  isLeader?: boolean;
}

const KNOWN: Record<string, Omit<AgentMeta, 'id'>> = {
  'sdd-orchestrator': {
    name: 'Clara',
    codename: 'Clara',
    title: 'Directora de Orquesta & Comandante',
    short: 'CL',
    role: 'Orchestrator',
    color: '#10b981',
    accentGlow: 'rgba(16, 185, 129, 0.4)',
    personality: 'Lúcida, serena, líder natural. Asigna tareas y vela por los gates.',
    isLeader: true,
  },
  'sdd-functional': {
    name: 'Sophia',
    codename: 'Sophia',
    title: 'Diseñadora de Producto & UX',
    short: 'SO',
    role: 'Functional',
    color: '#38bdf8',
    accentGlow: 'rgba(56, 189, 248, 0.4)',
    personality: 'Empática y orientada al valor. Modela historias de negocio.',
  },
  'sdd-planner': {
    name: 'Chronos',
    codename: 'Chronos',
    title: 'Maestro del Tiempo & WBS',
    short: 'CH',
    role: 'Planner',
    color: '#a855f7',
    accentGlow: 'rgba(168, 85, 247, 0.4)',
    personality: 'Metódico y ordenado. Descompone tareas y calcula story points.',
  },
  'sdd-architect': {
    name: 'Daedalus',
    codename: 'Daedalus',
    title: 'Guardián de Contratos & Sistemas',
    short: 'DA',
    role: 'Architect',
    color: '#ec4899',
    accentGlow: 'rgba(236, 72, 153, 0.4)',
    personality: 'Riguroso y técnico. Diseña contratos de API y schemas.',
  },
  'sdd-implementor-back': {
    name: 'Vulcan',
    codename: 'Vulcan',
    title: 'Forjador de Backend & Motores',
    short: 'VU',
    role: 'Impl-back',
    color: '#f59e0b',
    accentGlow: 'rgba(245, 158, 11, 0.4)',
    personality: 'Pragmático y robusto. TDD, APIs limpias y cero código muerto.',
  },
  'sdd-implementor-front': {
    name: 'Aurora',
    codename: 'Aurora',
    title: 'Artista de Interfaz & 60fps',
    short: 'AU',
    role: 'Impl-front',
    color: '#f97316',
    accentGlow: 'rgba(249, 115, 22, 0.4)',
    personality: 'Creativa y detallista. Fluidez, microinteracciones y alta estética.',
  },
  'sdd-reviewer': {
    name: 'Argus',
    codename: 'Argus',
    title: 'Ojo Crítico & Guardián de Gates',
    short: 'AR',
    role: 'Reviewer',
    color: '#06b6d4',
    accentGlow: 'rgba(6, 182, 212, 0.4)',
    personality: 'Incorruptible y minucioso. Valida tests, calidad y telemetría.',
  },
  'sdd-steward': {
    name: 'Jarvis',
    codename: 'Jarvis',
    title: 'Conserje del Repositorio & Kit',
    short: 'JA',
    role: 'Steward',
    color: '#94a3b8',
    accentGlow: 'rgba(148, 163, 184, 0.4)',
    personality: 'Servicial y ágil. Administra el kit, rtk y la salud del repo.',
  },
  'sdd-hermes': {
    name: 'Mercurio',
    codename: 'Mercurio',
    title: 'Explorador de Ideas & Spark Launcher',
    short: 'ME',
    role: 'Hermes',
    color: '#84cc16',
    accentGlow: 'rgba(132, 204, 22, 0.4)',
    personality: 'Ágil y entusiasta. Convierte ideas en specs listas para ejecutar.',
  },
};

export function agentMeta(id: string): AgentMeta {
  const known = KNOWN[id];
  if (known) return { id, ...known };
  const raw = id.replace(/^sdd-/, '');
  const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1);
  return {
    id,
    name: capitalized,
    codename: capitalized,
    title: 'Agente Especialista',
    short: raw.slice(0, 2).toUpperCase(),
    role: capitalized,
    color: '#a1a1aa',
    accentGlow: 'rgba(161, 161, 170, 0.3)',
    personality: 'Agente autónomo del sistema SDD.',
  };
}

export function allKnownAgents(): AgentMeta[] {
  return Object.keys(KNOWN).map((id) => agentMeta(id));
}
