export interface SwarmDialogue {
  id: string;
  from: string;
  to: string;
  text: string;
  phase: 'orchestration' | 'functional' | 'planning' | 'architecture' | 'implementation' | 'review' | 'stewardship';
}

export const SDD_SWARM_SCRIPT: SwarmDialogue[] = [
  {
    id: 'dlg-1',
    from: 'sdd-orchestrator',
    to: 'sdd-functional',
    text: 'Sophia, iniciamos el ciclo. Analicemos el brief y modelemos las historias de usuario con criterios de aceptación.',
    phase: 'orchestration',
  },
  {
    id: 'dlg-2',
    from: 'sdd-functional',
    to: 'sdd-orchestrator',
    text: 'Brief procesado. Historias funcionales y casos de uso listos para desglose técnico.',
    phase: 'functional',
  },
  {
    id: 'dlg-3',
    from: 'sdd-orchestrator',
    to: 'sdd-planner',
    text: 'Chronos, toma las historias de Sophia. Descompón el WBS en tareas atómicas y asigna story points.',
    phase: 'orchestration',
  },
  {
    id: 'dlg-4',
    from: 'sdd-planner',
    to: 'sdd-architect',
    text: 'WBS finalizado con 7 tareas estimadas. Daedalus, revisa dependencias y contratos de tipos necesarios.',
    phase: 'planning',
  },
  {
    id: 'dlg-5',
    from: 'sdd-architect',
    to: 'sdd-implementor-back',
    text: 'Contratos validados con schemas estrictos. Vulcan, procede con endpoints de WebSocket y handlers del bridge.',
    phase: 'architecture',
  },
  {
    id: 'dlg-6',
    from: 'sdd-architect',
    to: 'sdd-implementor-front',
    text: 'Tipos y stores sincronizados. Aurora, implementa las vistas visuales reactivas y componentes del canvas.',
    phase: 'architecture',
  },
  {
    id: 'dlg-7',
    from: 'sdd-implementor-back',
    to: 'sdd-implementor-front',
    text: 'Aurora, puente WebSocket listo en puerto local. Ya podés enlazar el estado reactivo de presencia y telemetría.',
    phase: 'implementation',
  },
  {
    id: 'dlg-8',
    from: 'sdd-implementor-front',
    to: 'sdd-reviewer',
    text: 'Vistas e interacción del mapa ensambladas. Argus, te paso el PR para auditoría, tests y verificación de accesibilidad.',
    phase: 'implementation',
  },
  {
    id: 'dlg-9',
    from: 'sdd-implementor-back',
    to: 'sdd-reviewer',
    text: 'Backend validado con 54 suites de pruebas en verde. Argus, solicitando pase de SPEC GATE.',
    phase: 'implementation',
  },
  {
    id: 'dlg-10',
    from: 'sdd-reviewer',
    to: 'sdd-orchestrator',
    text: 'Revisión final completada. Todos los gates en verde, cero comentarios en código y telemetría registrada. Aprobado para cierre.',
    phase: 'review',
  },
  {
    id: 'dlg-11',
    from: 'sdd-orchestrator',
    to: 'sdd-steward',
    text: 'Atlas, consolidemos los fragmentos de contexto y registremos las lecciones aprendidas en memory journal.',
    phase: 'stewardship',
  },
  {
    id: 'dlg-12',
    from: 'sdd-steward',
    to: 'sdd-orchestrator',
    text: 'Contexto consolidado, schemas verificados y workspace en estado óptimo. Enjambre listo para la siguiente misión.',
    phase: 'stewardship',
  },
];
