import type { Presence } from '@sdd-studio/protocol';
import type { ThreadState } from '@/lib/store/timeline';
import type { GateId } from '@/lib/gates';

export type HarnessProvider = 'claude' | 'gemini' | 'copilot';

export interface SwarmDialogue {
  id: string;
  from: string;
  to: string;
  text: string;
  phase: 'orchestration' | 'functional' | 'planning' | 'architecture' | 'implementation' | 'review' | 'stewardship' | 'runtime';
  isLive?: boolean;
  tool?: string;
  gateId?: GateId;
  timestamp?: string;
  threadId?: string;
  provider?: HarnessProvider;
  engineSessionId?: string;
  threadTitle?: string;
  seq?: number;
}

export interface ExtractDialogueOptions {
  threadId?: string;
  specId?: string;
  fixId?: string;
  limit?: number;
}

// SPEC-004: Topología interactiva de Gates y live chat
export const SPEC_004_SCRIPT: SwarmDialogue[] = [
  {
    id: 'spec4-1',
    from: 'sdd-orchestrator',
    to: 'sdd-steward',
    text: 'Regla Cero verificada: modelo estándar seleccionado, presupuesto de tokens y contexto mínimo asegurados para SPEC-004.',
    phase: 'orchestration',
    gateId: 'regla-cero',
    timestamp: '2026-10-24T12:00:10.000Z',
    provider: 'claude',
    engineSessionId: 'session-spec-004-gates',
    threadTitle: 'spec-e-burgos-004-studio-gates-topology',
  },
  {
    id: 'spec4-2',
    from: 'sdd-orchestrator',
    to: 'sdd-hermes',
    text: 'SPEC GATE A evaluado: spec registrada en specs/index.json, dependencias de spec-003 completadas y ciclo aprobado.',
    phase: 'orchestration',
    gateId: 'gate-a',
    timestamp: '2026-10-24T12:01:15.000Z',
    provider: 'claude',
    engineSessionId: 'session-spec-004-gates',
  },
  {
    id: 'spec4-3',
    from: 'sdd-orchestrator',
    to: 'sdd-functional',
    text: 'Sophia, definamos las historias para representar las 6 Gates en el lienzo y el inspector en Split-View.',
    phase: 'functional',
    timestamp: '2026-10-24T12:02:00.000Z',
    provider: 'claude',
    engineSessionId: 'session-spec-004-gates',
  },
  {
    id: 'spec4-4',
    from: 'sdd-functional',
    to: 'sdd-planner',
    text: 'Historias US-1..US-5 cerradas. Chronos, desglosa el WBS con las tareas atómicas TASK-001 a 006.',
    phase: 'planning',
    timestamp: '2026-10-24T12:03:30.000Z',
    provider: 'claude',
    engineSessionId: 'session-spec-004-gates',
  },
  {
    id: 'spec4-5',
    from: 'sdd-planner',
    to: 'sdd-architect',
    text: 'Daedalus, WBS cerrado con 21 story points en tasks.json. Diseña el catálogo tipado de gates.ts.',
    phase: 'architecture',
    timestamp: '2026-10-24T12:05:00.000Z',
    provider: 'claude',
    engineSessionId: 'session-spec-004-gates',
  },
  {
    id: 'spec4-6',
    from: 'sdd-architect',
    to: 'sdd-implementor-front',
    text: 'SPEC GATE B verificado: gates.ts modelado con las 6 puertas. Aurora y Vulcan, autorizados a implementar.',
    phase: 'architecture',
    gateId: 'gate-b',
    timestamp: '2026-10-24T12:06:20.000Z',
    provider: 'claude',
    engineSessionId: 'session-spec-004-gates',
  },
  {
    id: 'spec4-7',
    from: 'sdd-implementor-front',
    to: 'sdd-reviewer',
    text: 'Aurora: GateCard, GateInspectorDrawer y AgentInspectorDrawer en Split-View ensamblados con arcos SVG reactivos.',
    phase: 'implementation',
    timestamp: '2026-10-24T12:10:45.000Z',
    provider: 'claude',
    engineSessionId: 'session-spec-004-gates',
  },
  {
    id: 'spec4-8',
    from: 'sdd-implementor-back',
    to: 'sdd-reviewer',
    text: 'Vulcan: Suite de gates.spec.ts completada y 100% verde sin regresiones en el monorepo.',
    phase: 'implementation',
    timestamp: '2026-10-24T12:12:10.000Z',
    provider: 'claude',
    engineSessionId: 'session-spec-004-gates',
  },
  {
    id: 'spec4-9',
    from: 'sdd-reviewer',
    to: 'sdd-orchestrator',
    text: 'CONTEXTO GATE aprobado: fragmento 2026-10-24 en updates/, CA-1..CA-6 validados y pnpm sdd:validate en verde.',
    phase: 'review',
    gateId: 'contexto-gate',
    timestamp: '2026-10-24T12:15:00.000Z',
    provider: 'claude',
    engineSessionId: 'session-spec-004-gates',
  },
  {
    id: 'spec4-10',
    from: 'sdd-reviewer',
    to: 'sdd-orchestrator',
    text: 'MEMORIA GATE: lecciones registradas. Spec-004 completada con éxito en flow lite.',
    phase: 'review',
    gateId: 'memoria-gate',
    timestamp: '2026-10-24T12:18:00.000Z',
    provider: 'claude',
    engineSessionId: 'session-spec-004-gates',
  },
];

// SPEC-003: Mission control, topología de agentes y telemetría
export const SPEC_003_SCRIPT: SwarmDialogue[] = [
  {
    id: 'spec3-1',
    from: 'sdd-orchestrator',
    to: 'sdd-hermes',
    text: 'Iniciamos SPEC-003: Mission Control para SDD Studio con visualización 2D de enjambre y telemetría HUD.',
    phase: 'orchestration',
    gateId: 'gate-a',
    timestamp: '2026-10-23T14:10:00.000Z',
    provider: 'gemini',
    engineSessionId: 'session-spec-003-gemini',
  },
  {
    id: 'spec3-2',
    from: 'sdd-orchestrator',
    to: 'sdd-functional',
    text: 'Sophia, definamos la personalidad, avatares SVG y roles para los 9 agentes del enjambre.',
    phase: 'functional',
    timestamp: '2026-10-23T14:15:00.000Z',
    provider: 'gemini',
    engineSessionId: 'session-spec-003-gemini',
  },
  {
    id: 'spec3-3',
    from: 'sdd-functional',
    to: 'sdd-planner',
    text: 'Chronos, historias US-1..US-6 listas. Desglosa las tareas atómicas TASK-001 a 007 con 22 story points.',
    phase: 'planning',
    timestamp: '2026-10-23T14:20:00.000Z',
    provider: 'gemini',
    engineSessionId: 'session-spec-003-gemini',
  },
  {
    id: 'spec3-4',
    from: 'sdd-planner',
    to: 'sdd-architect',
    text: 'Daedalus, tareas listas en tasks.json. Diseñemos el lienzo de coordenadas SVG 1000x860 y estado de presencia.',
    phase: 'architecture',
    gateId: 'gate-b',
    timestamp: '2026-10-23T14:30:00.000Z',
    provider: 'gemini',
    engineSessionId: 'session-spec-003-gemini',
  },
  {
    id: 'spec3-5',
    from: 'sdd-implementor-front',
    to: 'sdd-implementor-back',
    text: 'Aurora: AgentMapCanvas, AgentNode y LiveTelemetryHUD montados en Studio.',
    phase: 'implementation',
    timestamp: '2026-10-23T15:00:00.000Z',
    provider: 'gemini',
    engineSessionId: 'session-spec-003-gemini',
  },
  {
    id: 'spec3-6',
    from: 'sdd-reviewer',
    to: 'sdd-orchestrator',
    text: 'Argus: CA-1 a CA-7 verificados, 409 tests pasando al 100%. Contexto Gate aprobado.',
    phase: 'review',
    gateId: 'contexto-gate',
    timestamp: '2026-10-23T15:40:00.000Z',
    provider: 'gemini',
    engineSessionId: 'session-spec-003-gemini',
  },
];

// SPEC-002: Pulido de UI, viewport y eventos
export const SPEC_002_SCRIPT: SwarmDialogue[] = [
  {
    id: 'spec2-1',
    from: 'sdd-orchestrator',
    to: 'sdd-functional',
    text: 'Iniciamos SPEC-002: solucionar viewport anclado, deduplicación de eventos bot y menú @.',
    phase: 'orchestration',
    gateId: 'gate-a',
    timestamp: '2026-10-23T11:00:00.000Z',
    provider: 'copilot',
    engineSessionId: 'session-spec-002-copilot',
  },
  {
    id: 'spec2-2',
    from: 'sdd-architect',
    to: 'sdd-implementor-front',
    text: 'SPEC GATE B: arquitectura de useStickToBottom y filtros de duplicados en useStudioStore aprobados.',
    phase: 'architecture',
    gateId: 'gate-b',
    timestamp: '2026-10-23T11:30:00.000Z',
    provider: 'copilot',
    engineSessionId: 'session-spec-002-copilot',
  },
  {
    id: 'spec2-3',
    from: 'sdd-implementor-front',
    to: 'sdd-reviewer',
    text: 'Aurora: Scroll inteligente anclado al fondo y menú @ implementado sin parpadeos.',
    phase: 'implementation',
    timestamp: '2026-10-23T12:15:00.000Z',
    provider: 'copilot',
    engineSessionId: 'session-spec-002-copilot',
  },
  {
    id: 'spec2-4',
    from: 'sdd-reviewer',
    to: 'sdd-orchestrator',
    text: 'Argus: Validación en verde. Viewport estable y cero eventos duplicados en tests.',
    phase: 'review',
    gateId: 'contexto-gate',
    timestamp: '2026-10-23T12:45:00.000Z',
    provider: 'copilot',
    engineSessionId: 'session-spec-002-copilot',
  },
];

// SPEC-001: UX de sesión, aprobación 'Always' e imágenes
export const SPEC_001_SCRIPT: SwarmDialogue[] = [
  {
    id: 'spec1-1',
    from: 'sdd-orchestrator',
    to: 'sdd-hermes',
    text: 'SPEC-001 apertura: soporte de reglas Always por sesión, imágenes en chat y navegación de hilos.',
    phase: 'orchestration',
    gateId: 'gate-a',
    timestamp: '2026-10-23T08:00:00.000Z',
    provider: 'claude',
    engineSessionId: 'session-spec-001-session-ux',
  },
  {
    id: 'spec1-2',
    from: 'sdd-planner',
    to: 'sdd-architect',
    text: 'WBS de cycle-01 y cycle-02 planificado. Diseñemos el store de attachments con hash SHA-256.',
    phase: 'planning',
    timestamp: '2026-10-23T08:30:00.000Z',
    provider: 'claude',
    engineSessionId: 'session-spec-001-session-ux',
  },
  {
    id: 'spec1-3',
    from: 'sdd-implementor-back',
    to: 'sdd-implementor-front',
    text: 'Vulcan: AttachmentStore implementado en el bridge con persistencia en disco y tests e2e.',
    phase: 'implementation',
    timestamp: '2026-10-23T09:30:00.000Z',
    provider: 'claude',
    engineSessionId: 'session-spec-001-session-ux',
  },
  {
    id: 'spec1-4',
    from: 'sdd-reviewer',
    to: 'sdd-orchestrator',
    text: 'Argus: cycle-02 completado con éxito. Las aprobaciones automáticas persisten durante la sesión.',
    phase: 'review',
    gateId: 'contexto-gate',
    timestamp: '2026-10-23T10:15:00.000Z',
    provider: 'claude',
    engineSessionId: 'session-spec-001-session-ux',
  },
];

// FIX-003-001: Corrección de crash undefined filter y caras dibujadas
export const FIX_003_001_SCRIPT: SwarmDialogue[] = [
  {
    id: 'fix3-1',
    from: 'sdd-steward',
    to: 'sdd-orchestrator',
    text: 'FIX GATE activado: detectado crash TypeError undefined filter al usar useStudio vs useBridge.',
    phase: 'stewardship',
    gateId: 'fix-gate',
    timestamp: '2026-10-23T16:00:00.000Z',
    provider: 'claude',
    engineSessionId: 'session-fix-003-001',
  },
  {
    id: 'fix3-2',
    from: 'sdd-steward',
    to: 'sdd-implementor-front',
    text: 'Registrado FIX-e-burgos-003-001 en sdd/fixes.json. Autorizado a implementar corrección.',
    phase: 'stewardship',
    gateId: 'fix-gate',
    timestamp: '2026-10-23T16:05:00.000Z',
    provider: 'claude',
    engineSessionId: 'session-fix-003-001',
  },
  {
    id: 'fix3-3',
    from: 'sdd-implementor-front',
    to: 'sdd-reviewer',
    text: 'Aurora: Corregido acceso seguro en useStudio, añadidos avatares SVG dibujados y roles visibles.',
    phase: 'implementation',
    timestamp: '2026-10-23T16:20:00.000Z',
    provider: 'claude',
    engineSessionId: 'session-fix-003-001',
  },
  {
    id: 'fix3-4',
    from: 'sdd-reviewer',
    to: 'sdd-steward',
    text: 'Argus: Auditoría completada. 0 regresiones y fix marcado como validated en fixes.json.',
    phase: 'review',
    timestamp: '2026-10-23T16:30:00.000Z',
    provider: 'claude',
    engineSessionId: 'session-fix-003-001',
  },
];

// FIX-001: Run validate en CI
export const FIX_001_SCRIPT: SwarmDialogue[] = [
  {
    id: 'fix1-1',
    from: 'sdd-steward',
    to: 'sdd-orchestrator',
    text: 'FIX GATE: Añadir paso de verificación pnpm sdd:validate al workflow de GitHub Actions.',
    phase: 'stewardship',
    gateId: 'fix-gate',
    timestamp: '2026-10-23T13:00:00.000Z',
    provider: 'gemini',
    engineSessionId: 'session-fix-001-gemini',
  },
  {
    id: 'fix1-2',
    from: 'sdd-implementor-back',
    to: 'sdd-reviewer',
    text: 'Workflow .github/workflows/ci.yml actualizado con job sdd-validate en cada push y PR.',
    phase: 'implementation',
    timestamp: '2026-10-23T13:10:00.000Z',
    provider: 'gemini',
    engineSessionId: 'session-fix-001-gemini',
  },
  {
    id: 'fix1-3',
    from: 'sdd-reviewer',
    to: 'sdd-steward',
    text: 'Check ejecutado local y verificado en verde. FIX-001 validated.',
    phase: 'review',
    timestamp: '2026-10-23T13:15:00.000Z',
    provider: 'gemini',
    engineSessionId: 'session-fix-001-gemini',
  },
];

export const SDD_SWARM_SCRIPT = SPEC_004_SCRIPT;

export const SWARM_SCRIPTS_BY_SPEC: Record<string, SwarmDialogue[]> = {
  'spec-e-burgos-004-studio-gates-topology': SPEC_004_SCRIPT,
  'spec-e-burgos-003-studio-mission-control': SPEC_003_SCRIPT,
  'spec-e-burgos-002-studio-ui-polish': SPEC_002_SCRIPT,
  'spec-e-burgos-001-studio-session-ux': SPEC_001_SCRIPT,
  'FIX-e-burgos-003-001': FIX_003_001_SCRIPT,
  'FIX-e-burgos-001': FIX_001_SCRIPT,
};

function resolveAgentId(author: unknown, fallback: string = 'sdd-orchestrator'): string {
  if (!author) return fallback;
  if (typeof author === 'string') return author.startsWith('sdd-') ? author : fallback;
  if (typeof author === 'object' && 'agent' in author && typeof (author as { agent: unknown }).agent === 'string') {
    const agent = (author as { agent: string }).agent;
    return agent.startsWith('sdd-') ? agent : fallback;
  }
  return fallback;
}

export function inferGateFromText(text?: string): GateId | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes('regla cero') || lower.includes('regla-cero') || lower.includes('regla ⓪')) return 'regla-cero';
  if (lower.includes('gate a') || lower.includes('gate-a') || lower.includes('spec gate a')) return 'gate-a';
  if (lower.includes('gate b') || lower.includes('gate-b') || lower.includes('spec gate b')) return 'gate-b';
  if (lower.includes('contexto') || lower.includes('constitution') || lower.includes('updates/')) return 'contexto-gate';
  if (lower.includes('fix gate') || lower.includes('fix-gate') || lower.includes('hotfix') || lower.includes('bugfix') || lower.includes('bypass')) return 'fix-gate';
  if (lower.includes('memoria') || lower.includes('lessons') || lower.includes('journal')) return 'memoria-gate';
  return undefined;
}

export function detectHarnessProvider(thread?: ThreadState | null): HarnessProvider {
  if (!thread || !thread.items) return 'claude';
  const opt = (thread.info as unknown as { provider?: string })?.provider;
  if (opt === 'gemini') return 'gemini';
  if (opt === 'copilot') return 'copilot';
  if (opt === 'claude') return 'claude';

  for (const item of thread.items) {
    if (item.kind === 'message' || item.kind === 'tool') {
      if (item.id.startsWith('msg_01') || item.id.startsWith('toolu_01')) {
        return 'claude';
      }
      const t = (item as { text?: string }).text?.toLowerCase() ?? '';
      if (t.includes('gemini') || t.includes('antigravity')) return 'gemini';
      if (t.includes('copilot')) return 'copilot';
    }
  }
  return 'claude';
}

export function extractRuntimeDialogues(
  presence: Presence[],
  threads: Record<string, ThreadState>,
  options?: ExtractDialogueOptions,
): SwarmDialogue[] {
  const result: SwarmDialogue[] = [];
  const limit = options?.limit ?? 50;

  const sortedThreads = Object.values(threads)
    .filter((t) => t.info)
    .sort((a, b) => new Date(b.info!.lastActivity).getTime() - new Date(a.info!.lastActivity).getTime());

  // 1. Encontrar la conversación objetivo
  let targetThread: ThreadState | undefined;
  if (options?.threadId) {
    targetThread = threads[options.threadId];
  } else if (options?.fixId) {
    const fId = options.fixId.toLowerCase();
    targetThread = sortedThreads.find(
      (t) =>
        (t.info?.link?.target?.kind === 'fix' && t.info.link.target.fixId.toLowerCase() === fId) ||
        t.info?.title.toLowerCase().includes(fId),
    );
  } else if (options?.specId) {
    const sId = options.specId.toLowerCase();
    targetThread = sortedThreads.find(
      (t) =>
        (t.info?.link?.target?.kind === 'cycle' && t.info.link.target.specId.toLowerCase() === sId) ||
        t.info?.title.toLowerCase().includes(sId),
    );
  }

  // Si no se especificó o no se encontró, usar la última conversación que tuvo el enjambre
  if (!targetThread && sortedThreads.length > 0 && !options?.fixId && !options?.specId) {
    targetThread = sortedThreads[0];
  }

  if (targetThread && targetThread.info && (targetThread.items ?? []).length > 0) {
    const threadAgent = targetThread.info.agent ?? 'sdd-orchestrator';
    const provider = detectHarnessProvider(targetThread);
    const engineSessionId =
      (targetThread.info as unknown as { engineSessionId?: string; providerSessionId?: string })
        ?.engineSessionId ??
      (targetThread.info as unknown as { providerSessionId?: string })?.providerSessionId ??
      targetThread.info.id;
    const threadTitle = targetThread.info.title;

    const tStart = new Date(targetThread.info.createdAt).getTime();
    const tEnd = new Date(targetThread.info.lastActivity).getTime();
    const items = targetThread.items ?? [];
    const totalItems = items.length;

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const timeMs = tStart + ((tEnd - tStart) * idx) / Math.max(1, totalItems - 1);
      const timestamp = new Date(timeMs).toISOString();

      if (item.kind === 'user' && item.text?.trim()) {
        result.push({
          id: `live-user-${item.id}`,
          from: 'user',
          to: threadAgent,
          text: item.text,
          phase: 'runtime',
          isLive: false,
          timestamp,
          threadId: targetThread.info.id,
          provider,
          engineSessionId,
          threadTitle,
          seq: idx + 1,
        });
      } else if (item.kind === 'message' && item.text?.trim()) {
        const fromAgent = resolveAgentId(item.author, threadAgent);
        result.push({
          id: `live-msg-${item.id}`,
          from: fromAgent,
          to: 'user',
          text: item.text,
          phase: 'runtime',
          isLive: false,
          gateId: inferGateFromText(item.text),
          timestamp,
          threadId: targetThread.info.id,
          provider,
          engineSessionId,
          threadTitle,
          seq: idx + 1,
        });
      } else if (item.kind === 'tool') {
        const fromAgent = resolveAgentId(item.author, threadAgent);
        result.push({
          id: `live-tool-${item.id}`,
          from: fromAgent,
          to: 'sdd-orchestrator',
          text: `${item.tool}: ${item.summary || 'Ejecución de herramienta'}`,
          phase: 'runtime',
          isLive: item.status === 'running',
          tool: item.tool,
          gateId: inferGateFromText(item.summary),
          timestamp,
          threadId: targetThread.info.id,
          provider,
          engineSessionId,
          threadTitle,
          seq: idx + 1,
        });
      } else if (item.kind === 'approval') {
        const fromAgent = resolveAgentId(item.author, threadAgent);
        result.push({
          id: `live-appr-${item.id}`,
          from: fromAgent,
          to: 'sdd-reviewer',
          text: item.gateWarning ? `Gate Check: ${item.gateWarning}` : item.summary,
          phase: 'runtime',
          isLive: item.decision === 'pending',
          gateId: inferGateFromText(item.gateWarning || item.summary),
          timestamp,
          threadId: targetThread.info.id,
          provider,
          engineSessionId,
          threadTitle,
          seq: idx + 1,
        });
      } else if (item.kind === 'subagent') {
        result.push({
          id: `live-sub-${item.id}`,
          from: threadAgent,
          to: resolveAgentId(item.agentType, 'sdd-steward'),
          text: `Subagente ${item.agentType} ${item.phase === 'start' ? 'iniciado' : 'finalizado'}`,
          phase: 'runtime',
          isLive: item.phase === 'start',
          timestamp,
          threadId: targetThread.info.id,
          provider,
          engineSessionId,
          threadTitle,
          seq: idx + 1,
        });
      }
    }
  }

  // Si hay agentes activos en presencia en este instante, se añaden al flujo en vivo
  const now = new Date().toISOString();
  for (const p of presence) {
    if (p.state === 'working' || p.tool) {
      result.push({
        id: `live-presence-${p.agent}`,
        from: p.agent,
        to: 'sdd-orchestrator',
        text: p.tool ? `Ejecutando ${p.tool}${p.specId ? ` en ${p.specId}` : ''}` : 'Procesando tarea activa en el workspace...',
        phase: 'runtime',
        isLive: true,
        tool: p.tool ?? undefined,
        timestamp: now,
        seq: result.length + 1,
      });
    } else if (p.state === 'waiting') {
      result.push({
        id: `live-waiting-${p.agent}`,
        from: p.agent,
        to: 'sdd-orchestrator',
        text: 'Aguardando autorización o respuesta en el hilo de ejecución.',
        phase: 'runtime',
        isLive: true,
        timestamp: now,
        seq: result.length + 1,
      });
    }
  }

  // Si no había eventos en vivo en ese hilo específico ni presencia activa, usar el guión canónico del spec/fix
  if (result.length === 0) {
    if (options?.fixId && SWARM_SCRIPTS_BY_SPEC[options.fixId]) {
      return SWARM_SCRIPTS_BY_SPEC[options.fixId].slice(-limit);
    }
    if (options?.specId && SWARM_SCRIPTS_BY_SPEC[options.specId]) {
      return SWARM_SCRIPTS_BY_SPEC[options.specId].slice(-limit);
    }
    if (options?.specId || options?.fixId) {
      return SDD_SWARM_SCRIPT.slice(-limit);
    }
    return [];
  }

  // Orden cronológico: el último mensaje está al final (abajo)
  return result.slice(-limit);
}
