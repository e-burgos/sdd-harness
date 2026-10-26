export interface AgentGeneratedDocument {
  id: string;
  name: string;
  path: string;
  type: 'spec' | 'plan' | 'wbs' | 'architecture' | 'code' | 'context' | 'review' | 'fix' | 'test';
  status: 'generated' | 'modified' | 'approved';
  description: string;
}

export interface AgentDocContext {
  specId: string;
  cycleId?: string;
  fixId?: string;
  flow?: string;
}

export function getAgentGeneratedDocuments(
  agentId: string,
  ctx: AgentDocContext,
): AgentGeneratedDocument[] {
  const { specId, cycleId = 'cycle-01', fixId } = ctx;

  // Si hay un fix específico seleccionado
  if (fixId) {
    if (agentId === 'sdd-steward' || agentId === 'sdd-orchestrator') {
      return [
        {
          id: `fix-doc-${fixId}`,
          name: `${fixId}.md`,
          path: `sdd/specs/${specId}/fixes/${fixId.toLowerCase()}.md`,
          type: 'fix',
          status: 'generated',
          description: `Documento de justificación, análisis de causa raíz y checklist del ${fixId}.`,
        },
        {
          id: 'fixes-registry',
          name: 'fixes.json',
          path: 'sdd/fixes.json',
          type: 'fix',
          status: 'modified',
          description: `Registro formal del fix en el catálogo central de fixes con telemetría de uso.`,
        },
      ];
    }
    if (agentId === 'sdd-implementor-front' || agentId === 'sdd-implementor-back') {
      return [
        {
          id: `fix-code-${fixId}`,
          name: 'Implementación del Fix',
          path: `apps/studio/src/`,
          type: 'code',
          status: 'modified',
          description: `Correcciones de código aplicadas para solventar ${fixId} con cero regresiones.`,
        },
      ];
    }
    if (agentId === 'sdd-reviewer') {
      return [
        {
          id: `fix-review-${fixId}`,
          name: 'Validación del Fix',
          path: `sdd/fixes.json#${fixId}`,
          type: 'review',
          status: 'approved',
          description: `Auditoría técnica del fix: verificación de no-regresión y estado validated.`,
        },
      ];
    }
    return [];
  }

  // Mapeo por agente según el spec actual
  switch (agentId) {
    case 'sdd-orchestrator': {
      const docs: AgentGeneratedDocument[] = [
        {
          id: `spec-md-${specId}`,
          name: `${specId}.spec.md`,
          path: `sdd/specs/${specId}/${specId}.spec.md`,
          type: 'spec',
          status: 'generated',
          description: 'Especificación canónica con resumen ejecutivo, historias y criterios de aceptación (CA).',
        },
        {
          id: `cycle-json-${specId}`,
          name: 'cycle.json',
          path: `sdd/specs/${specId}/cycles/${cycleId}/cycle.json`,
          type: 'plan',
          status: 'generated',
          description: 'Registro de apertura del ciclo, métricas de tareas, tokens y estado de gates.',
        },
      ];

      // En spec-004 o spec-003 flow lite
      docs.push({
        id: `plan-md-${specId}`,
        name: 'plan.md',
        path: `sdd/specs/${specId}/cycles/${cycleId}/plan.md`,
        type: 'plan',
        status: 'generated',
        description: 'Plan lite unificado de ejecución: objetivos, historias, desglose de tareas y decisiones técnicas.',
      });

      return docs;
    }

    case 'sdd-functional': {
      if (specId.includes('004') || specId.includes('003')) {
        return [
          {
            id: `functional-lite-${specId}`,
            name: 'Historias & Criterios (plan.md)',
            path: `sdd/specs/${specId}/cycles/${cycleId}/plan.md#historias`,
            type: 'spec',
            status: 'generated',
            description: 'Modelado funcional: historias de usuario US-1 a US-5 con criterios de aceptación CA-1 a CA-6.',
          },
        ];
      }
      return [
        {
          id: `functional-md-${specId}`,
          name: 'functional.md',
          path: `sdd/specs/${specId}/cycles/${cycleId}/functional.md`,
          type: 'spec',
          status: 'generated',
          description: 'Especificación funcional detallada, flujos de usuario y reglas de negocio.',
        },
      ];
    }

    case 'sdd-planner': {
      return [
        {
          id: `tasks-json-${specId}`,
          name: 'tasks.json',
          path: `sdd/specs/${specId}/cycles/${cycleId}/tasks.json`,
          type: 'wbs',
          status: 'generated',
          description: 'Estructura WBS con desglose de tareas atómicas (TASK-001..006), story points y dependencias.',
        },
      ];
    }

    case 'sdd-architect': {
      if (specId.includes('004')) {
        return [
          {
            id: 'gates-model-ts',
            name: 'gates.ts',
            path: 'apps/studio/src/lib/gates.ts',
            type: 'architecture',
            status: 'generated',
            description: 'Modelo canónico y contrato tipado de las 6 GATES del kit SDD con reglas y estados.',
          },
        ];
      }
      return [
        {
          id: `architect-md-${specId}`,
          name: 'architect.md',
          path: `sdd/specs/${specId}/cycles/${cycleId}/architect.md`,
          type: 'architecture',
          status: 'generated',
          description: 'Decisiones de arquitectura técnica, contratos de interfaces y diseño de esquemas.',
        },
      ];
    }

    case 'sdd-implementor-front': {
      if (specId.includes('004')) {
        return [
          {
            id: 'gate-card-tsx',
            name: 'GateCard.tsx',
            path: 'apps/studio/src/components/mission-control/GateCard.tsx',
            type: 'code',
            status: 'generated',
            description: 'Componente interactivo para renderizar las puertas en el cuadrante izquierdo del mapa.',
          },
          {
            id: 'gate-inspector-drawer-tsx',
            name: 'GateInspectorDrawer.tsx',
            path: 'apps/studio/src/components/mission-control/GateInspectorDrawer.tsx',
            type: 'code',
            status: 'generated',
            description: 'Panel lateral de inspección técnica de reglas, criterios y comandos CLI de cada Gate.',
          },
          {
            id: 'live-agent-chat-feed-tsx',
            name: 'LiveAgentChatFeed.tsx',
            path: 'apps/studio/src/components/mission-control/LiveAgentChatFeed.tsx',
            type: 'code',
            status: 'generated',
            description: 'Feed reactivo de conversación en tiempo real con streaming y respuesta rápida.',
          },
          {
            id: 'agent-inspector-drawer-tsx',
            name: 'AgentInspectorDrawer.tsx',
            path: 'apps/studio/src/components/mission-control/AgentInspectorDrawer.tsx',
            type: 'code',
            status: 'modified',
            description: 'Estructura Split-View integrando perfil técnico superior y chat agéntico inferior.',
          },
          {
            id: 'agent-map-canvas-tsx',
            name: 'AgentMapCanvas.tsx',
            path: 'apps/studio/src/components/mission-control/AgentMapCanvas.tsx',
            type: 'code',
            status: 'modified',
            description: 'Lienzo SVG expandido con ranuras de Gates y arcos SVG animados hacia agentes.',
          },
        ];
      }
      return [
        {
          id: 'ui-components',
          name: 'Componentes de Vista',
          path: 'apps/studio/src/components/',
          type: 'code',
          status: 'modified',
          description: 'Implementación de pantallas, interacción visual y estilos del ciclo.',
        },
      ];
    }

    case 'sdd-implementor-back': {
      if (specId.includes('004')) {
        return [
          {
            id: 'gates-spec-ts',
            name: 'gates.spec.ts',
            path: 'apps/studio/src/lib/gates.spec.ts',
            type: 'test',
            status: 'generated',
            description: 'Suite unitaria del catálogo de Gates, reglas canónicas y validación de conmutadores.',
          },
        ];
      }
      return [
        {
          id: 'backend-services',
          name: 'Lógica & Servicios',
          path: 'apps/studio-bridge/src/',
          type: 'code',
          status: 'modified',
          description: 'Implementación de endpoints, estado y protocolos de backend.',
        },
      ];
    }

    case 'sdd-reviewer': {
      return [
        {
          id: `context-update-${specId}`,
          name: `update-${specId}-${cycleId}.md`,
          path: `sdd/context/apps/studio/updates/2026-10-24-${specId}-${cycleId}.md`,
          type: 'context',
          status: 'generated',
          description: 'Fragmento aditivo de actualización técnica para CONTEXTO GATE (patrón changesets).',
        },
        {
          id: `reviewer-report-${specId}`,
          name: 'Reporte en cycle.json',
          path: `sdd/specs/${specId}/cycles/${cycleId}/cycle.json#reviewer_report`,
          type: 'review',
          status: 'approved',
          description: 'Verificación de criterios de aceptación CA-1..CA-6 y 100% test passing en vitest.',
        },
      ];
    }

    case 'sdd-steward': {
      return [
        {
          id: 'fixes-index',
          name: 'fixes.json',
          path: 'sdd/fixes.json',
          type: 'fix',
          status: 'modified',
          description: 'Supervisión y control del FIX GATE, salud del workspace y auditoría de herramientas.',
        },
      ];
    }

    case 'sdd-hermes': {
      return [
        {
          id: `spec-intake-${specId}`,
          name: `${specId}.spec.md (Intake)`,
          path: `sdd/specs/${specId}/${specId}.spec.md`,
          type: 'spec',
          status: 'generated',
          description: 'Exploración inicial de requerimientos e intake de spec previa a Gate A.',
        },
      ];
    }

    default:
      return [];
  }
}
