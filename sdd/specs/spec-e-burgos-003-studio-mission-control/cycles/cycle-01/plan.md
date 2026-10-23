# spec-e-burgos-003-studio-mission-control — cycle-01 · plan (lite)

> Módulo: studio-mission-control | Subproyectos: apps/studio, apps/studio-bridge | Fecha: 2026-10-23
> Objetivo: transformar SDD Studio en un Mission Control Center con topología de agentes interactiva, Clara como orquestadora estelar, avatares y personalidades vivas, dashboard dinámico del ecosistema y telemetría en tiempo real. Fuera de alcance: modificaciones en libs/studio-protocol (se reutiliza el protocolo existente v2 con sus modelos de Presence y WorkspaceSnapshot).

## Historias
- US-1 — Como desarrollador quiero ver a cada agente con su nombre real (Clara para el orquestador, Sophia, Chronos, Daedalus, Vulcan, Aurora, Argus, Jarvis, Mercurio), avatar holográfico estilizado, paleta cromática viva y micro-badges de rol. CA: `agentMeta` y `AgentAvatar` renderizan las 9 identidades con avatares visuales ricos; Clara destacada como líder del enjambre.
- US-2 — Como desarrollador quiero alternar de forma fluida en el topbar de Studio entre la vista de *Workspace (Chat/Hilos)*, el *Agent Map (Topología en vivo)*, el *Ecosystem Dashboard* y la *Telemetría HUD*. CA: selector segmentado accesible en `AppShell` / header que conmuta vistas sin perder el estado de la sesión activa ni conexiones WebSocket.
- US-3 — Como desarrollador quiero un mapa interactivo de topología en tiempo real con los nodos de los agentes conectados, con pulsos de estado (`idle`, `working`, `waiting-approval`) y animación de transferencia de tareas y contratos. CA: canvas 2D interactivo con SVG/CSS de alto rendimiento, nodos con resplandor según presencia activa recibida por el WebSocket, inspector lateral al hacer clic en un agente para ver sus tareas, herramientas y chat directo.
- US-4 — Como desarrollador quiero un dashboard inicial completo que muestre la salud y estado de todas las apps, libs y tools del monorepo, módulos del proyecto, progreso general de sprint y estado del SPEC GATE. CA: panel dinámico alimentado por `WorkspaceSnapshot` que lista subproyectos, módulos completed/in-progress, fixes activos y semáforo de gates.
- US-5 — Como desarrollador quiero una vista de telemetría en tiempo real con contadores vivos de tokens (In/Out/Total), costo financiero en USD acumulado según `pricing.json`, comparador tradicional vs agéntico y ahorro acumulado de rtk. CA: panel HUD con métricas actualizadas en tiempo real, desglose por modelo/tier y comparativa visual de ahorro.

## Tasks (detalle en tasks.json)
- TASK-001 — Catálogo enriquecido de identidades en `apps/studio/src/lib/agents.ts` con Clara (`sdd-orchestrator`), Sophia, Chronos, Daedalus, Vulcan, Aurora, Argus, Jarvis y Mercurio, avatares SVG estilizados, tonos y badges; actualización de `AgentAvatar.tsx` y tests.
- TASK-002 — Switcher de vistas en el header de Studio (`WorkspaceApp.tsx`, `AppShell.tsx`): pestañas para Workspace, Agent Map, Ecosystem y Telemetry con persistencia y atajos.
- TASK-003 — Componente `AgentMapCanvas.tsx`: topología en grafo de agentes interconectados con nodos reactivos a eventos de `Presence` (pulsos de estado, herramienta en ejecución, streaming de tokens) y partículas de handoff.
- TASK-004 — Panel de inspección `AgentInspectorDrawer.tsx`: drawer modal o lateral al cliquear un agente en el mapa con ficha de rol, modelo activo, herramientas recientes, tokens y botón para abrir DM directo.
- TASK-005 — Componente `EcosystemDashboard.tsx`: tablero dinámico de apps, libs y tools con métricas de salud, listado de specs, semáforo del SPEC GATE y avances de módulos desde `snapshot`.
- TASK-006 — Componente `LiveTelemetryHUD.tsx`: visualizador de telemetría en tiempo real con ticker de tokens in/out, estimador de costo en USD derivado de `pricing.json`, desglose por modelo y reporte de ahorro de rtk.
- TASK-007 — Integración general y suite completa de tests de componentes y estado para las nuevas vistas de Studio.

## Decisiones técnicas
- Reutilización estricta de `libs/studio-protocol` (v2): el protocolo actual ya transmite `Presence` (con estados `working`, `waiting`, `idle`, `tool`, `threadId`), `WorkspaceSnapshot` (con apps, specs, cycles, fixes, pricing) y `ThreadEvent` (con `usage`, `tool.start`, `approval.requested`). No requiere ningún bump de protocolo ni breaking changes en el puente.
- Visualización de grafos sin librerías pesadas: uso de SVG nativo reactivo y animaciones CSS de alto rendimiento (GPU-accelerated) para garantizar fluidez absoluta de 60fps dentro de Next.js sin añadir dependencias infladas.
- Persistencia de vista activa en `localStorage`: permite recargar la página y permanecer en el mapa de agentes o en el dashboard sin saltar forzosamente al chat.
