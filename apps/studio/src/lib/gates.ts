export type GateId =
  | 'regla-cero'
  | 'gate-a'
  | 'gate-b'
  | 'contexto-gate'
  | 'fix-gate'
  | 'memoria-gate';

export type GateGroup = 'cycle' | 'transversal';

export type GateStatus = 'passing' | 'active' | 'idle' | 'blocked';

export interface GateMeta {
  id: GateId;
  name: string;
  shortLabel: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  group: GateGroup;
  cliCommand: string;
  responsibleAgent: string;
  associatedAgents: string[];
  rules: string[];
}

export const SDD_GATES: Record<GateId, GateMeta> = {
  'regla-cero': {
    id: 'regla-cero',
    name: 'REGLA CERO',
    shortLabel: 'REGLA ⓪',
    subtitle: 'Tier, Modelo & Esfuerzo',
    description: 'Inviolable antes de cualquier acción: declara tier económico/estándar/alto/máximo, modelo y nivel de pensamiento.',
    icon: 'scale',
    color: '#eab308',
    group: 'transversal',
    cliCommand: 'Regla cero → tier: ... · modelo: ... · esfuerzo: ...',
    responsibleAgent: 'sdd-steward',
    associatedAgents: ['sdd-steward', 'sdd-orchestrator'],
    rules: [
      'Declarar una línea visible antes de tocar el workspace',
      'Verificar picker/dropdown contra tier necesario',
      'Contexto mínimo: no releer sin propósito',
    ],
  },
  'gate-a': {
    id: 'gate-a',
    name: 'SPEC GATE A',
    shortLabel: 'GATE A',
    subtitle: 'Apertura de Ciclo',
    description: 'Evalúa si se cumplen todas las condiciones para abrir un ciclo SDD antes de escribir el brief o plan.',
    icon: 'door-open',
    color: '#10b981',
    group: 'cycle',
    cliCommand: 'pnpm sdd:gate <spec-id>',
    responsibleAgent: 'sdd-orchestrator',
    associatedAgents: ['sdd-orchestrator', 'sdd-hermes'],
    rules: [
      'A1. Spec registrada en specs/index.json y archivo existe',
      'A2. Módulo en pending o in_progress_modules',
      'A3. Ningún otro ciclo de esa spec in-progress',
      'A4. Dependencias depends_on completadas',
      'A5. Spec no completed ni cancelled',
    ],
  },
  'gate-b': {
    id: 'gate-b',
    name: 'SPEC GATE B',
    shortLabel: 'GATE B',
    subtitle: 'Implementación de Código',
    description: 'Barrera estricta antes de la primera línea de código: exige cycle.json in-progress, tareas y constitution técnica.',
    icon: 'shield-check',
    color: '#38bdf8',
    group: 'cycle',
    cliCommand: 'pnpm sdd:gate <spec-id> cycle-XX',
    responsibleAgent: 'sdd-implementor-front',
    associatedAgents: [
      'sdd-functional',
      'sdd-planner',
      'sdd-architect',
      'sdd-implementor-back',
      'sdd-implementor-front',
    ],
    rules: [
      'B1. cycle.json existe con status in-progress',
      'B2. Módulo en in_progress_modules de global.json',
      'B3. tasks.json con al menos una tarea',
      'B4. Documentos del flow completos (plan.md en lite)',
      'B5. constitution.md de cada subproyecto listado',
    ],
  },
  'contexto-gate': {
    id: 'contexto-gate',
    name: 'CONTEXTO GATE',
    shortLabel: 'CONTEXTO',
    subtitle: 'Cierre & Updates Aditivos',
    description: 'Regla de cierre global: exige fragmento aditivo en updates/, actualización de tablas globales y telemetría de uso.',
    icon: 'puzzle',
    color: '#ec4899',
    group: 'cycle',
    cliCommand: 'pnpm sdd:validate',
    responsibleAgent: 'sdd-reviewer',
    associatedAgents: ['sdd-reviewer', 'sdd-orchestrator'],
    rules: [
      'Fragmento aditivo en updates/YYYY-MM-DD-[spec]-cycle-[XX].md',
      'Fila del subproyecto actualizada en constitution.md',
      'Validación pnpm sdd:validate en verde',
      'Registro de telemetría de tokens por agente obligatorio',
    ],
  },
  'fix-gate': {
    id: 'fix-gate',
    name: 'FIX GATE',
    shortLabel: 'FIX GATE',
    subtitle: 'Bypass Controlado',
    description: 'Vía rápida para hotfixes, bugfixes y mejoras menores sin ciclo completo, garantizando trazabilidad y registro en fixes.json.',
    icon: 'zap',
    color: '#f97316',
    group: 'cycle',
    cliCommand: 'sdd/prompts/hotfix-bypass-gate.prompt.md',
    responsibleAgent: 'sdd-steward',
    associatedAgents: ['sdd-steward', 'sdd-orchestrator'],
    rules: [
      'Registro correlativo en sdd/fixes.json',
      'Documento del fix en sdd/fixes/ o spec/fixes/',
      'No crea entidades ni contratos nuevos',
      'Registro de consumo de tokens usage obligatorio',
    ],
  },
  'memoria-gate': {
    id: 'memoria-gate',
    name: 'MEMORIA GATE',
    shortLabel: 'MEMORIA',
    subtitle: 'Autoaprendizaje & Journal',
    description: 'Preservación de conocimiento entre sesiones: consulta lecciones destiladas y registra hallazgos reales.',
    icon: 'brain',
    color: '#a855f7',
    group: 'transversal',
    cliCommand: 'sdd/memory/lessons.md',
    responsibleAgent: 'sdd-reviewer',
    associatedAgents: ['sdd-reviewer', 'sdd-orchestrator'],
    rules: [
      'Lectura de lessons.md completa al iniciar sesión',
      'Entrada en journal/ solo ante lecciones reales que eviten costo',
      'Destilación periódica con >= 5 entradas',
      'Filtro anti-ruido estricto',
    ],
  },
};

export const CYCLE_GATES: GateId[] = ['gate-a', 'gate-b', 'contexto-gate', 'fix-gate'];
export const TRANSVERSAL_GATES: GateId[] = ['regla-cero', 'memoria-gate'];
export const ALL_GATES: GateId[] = [
  'regla-cero',
  'gate-a',
  'gate-b',
  'contexto-gate',
  'fix-gate',
  'memoria-gate',
];

export function getGateMeta(id: GateId): GateMeta {
  return SDD_GATES[id];
}

export function getGatesByGroup(group: GateGroup): GateMeta[] {
  return Object.values(SDD_GATES).filter((g) => g.group === group);
}

export function getGatesForAgent(agentId: string): GateMeta[] {
  return Object.values(SDD_GATES).filter(
    (g) => g.responsibleAgent === agentId || g.associatedAgents.includes(agentId),
  );
}
