# spec-e-burgos-003-studio-mission-control cycle-01 — 2026-10-23

## Estado

- Mission Control y centro de comando en tiempo real completamente integrado en SDD Studio.
- Clara (`sdd-orchestrator`) lidera el enjambre de 9 agentes con identidad, tono, paleta `#10b981`, badge de corona `👑` y avatar glassmorphism interactivo.
- Barra de navegación superior `StudioHeader` con selector segmentado de 4 vistas (`workspace`, `agent-map`, `ecosystem`, `telemetry`), píldora de ciclo activo, contador dinámico de agentes en ejecución y selector bilingüe (ES/EN).
- Vista `AgentMapCanvas`: mapa topológico 2D SVG responsivo con conexiones bezier, animaciones dashed para agentes activos, nodos con aura de presencia y drawer lateral `AgentInspectorDrawer` para inspección y mensajería directa (DM).
- Vista `EcosystemDashboard`: tablero dinámico con KPIs de specs, tasks y sprint progress, estado de salud de subproyectos monorepo y semáforo del SPEC GATE.
- Vista `LiveTelemetryHUD`: panel en vivo con métricas de tokens (in/out/total), cálculo de inversión en USD según tarifas de `sdd/pricing.json`, ROI agéntico frente a tarifas tradicionales y métricas de compresión de `rtk`.

## Estructura

- `lib/agents.ts`: catálogo de 9 agentes con nombres propios, personalidades, paletas y `allKnownAgents()`.
- `components/StudioHeader.tsx`: cabecera global de la aplicación con segmented control y badges de telemetría.
- `components/mission-control/AgentMapCanvas.tsx`, `AgentNode.tsx`, `AgentInspectorDrawer.tsx`: canvas 2D de enjambre agéntico.
- `components/mission-control/EcosystemDashboard.tsx`: dashboard integral de proyectos, specs y gates.
- `components/mission-control/LiveTelemetryHUD.tsx`: telemetría en tiempo real y costos.
- `components/WorkspaceApp.tsx`: enrutamiento por vistas preservando estado del workspace y sincronización por localStorage.

## Dependencias

- Implementación con SVG nativo y CSS accelerated animations; cero dependencias de librerías de grafos pesadas adicionales.

## Qué sigue

- Telemetría por WebSocket streaming en tiempo real conforme agentes de Claude y Gemini emitan chunks durante los turnos.
