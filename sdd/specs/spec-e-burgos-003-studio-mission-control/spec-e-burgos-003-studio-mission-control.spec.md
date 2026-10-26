# SPEC-e-burgos-003: SDD Studio: Mission Control, topología de agentes en vivo, avatares con personalidad y telemetría en tiempo real

> Estado: **completed** — 2026-10-23. Flow `lite` (un solo actor), un ciclo.

## Resumen Ejecutivo

Transformación visual y funcional de SDD Studio (`apps/studio` y `apps/studio-bridge`) en un
**Mission Control Center** de nueva generación para el desarrollo con enjambres de agentes:

1. **Personalidades y Avatares del Equipo de Agentes**:
   - Asignación de identidades, tonos, paletas cromáticas vivas y avatares distintivos:
     - **Clara (`sdd-orchestrator`)**: Directora de orquesta, líder serena y estratega global (`#10b981`).
     - **Sophia (`sdd-functional`)**: Diseñadora de producto & UX (`#38bdf8`).
     - **Chronos (`sdd-planner`)**: Maestro del tiempo y tareas (`#a855f7`).
     - **Daedalus (`sdd-architect`)**: Guardián de contratos y arquitectura (`#ec4899`).
     - **Vulcan (`sdd-implementor-back`)**: Forjador del backend y persistencia (`#f59e0b`).
     - **Aurora (`sdd-implementor-front`)**: Artista de la interfaz y fluidez (`#f97316`).
     - **Argus (`sdd-reviewer`)**: Ojo crítico y verificador de gates (`#06b6d4`).
     - **Jarvis (`sdd-steward`)**: Conserje del repositorio y herramientas (`#94a3b8`).
     - **Mercurio (`sdd-hermes`)**: Explorador de ideas e incubador (`#84cc16`).

2. **Mapa de Agentes en Tiempo Real (Topology & Task Handoffs)**:
   - Lienzo 2D interactivo con grafos y nodos reactivos interconectados.
   - Animación de pulsos de actividad según el estado (`idle`, `working`, `waiting-approval`, `error`).
   - Visualización de transferencia de tareas y contratos (partículas luminosas en tránsito entre nodos).
   - Drawer de detalle al hacer clic en un agente: rol, modelo activo, herramientas ejecutadas y acceso a DM.

3. **Dashboard Dinámico del Ecosistema**:
   - Panel de control integral del monorepo que lista dinámicamente `apps/`, `libs/` y `tools/`.
   - Estado de módulos (completados, en progreso, pendientes), progreso general del sprint y semáforo del SPEC GATE.

4. **Vista de Telemetría en Tiempo Real (Live HUD)**:
   - Contador de tokens en vivo (Entrada, Salida, Total).
   - Ticker financiero con costo estimado acumulado en USD derivado de `sdd/pricing.json`.
   - Comparador de inversión agéntica vs costo tradicional (horas estimadas de tareas vs gasto en tokens).
   - Métricas de compresión y ahorro acumulado de rtk.

5. **Navegación Unificada de Modos en el Header**:
   - Selector entre vistas: *Workspace (Chat/Hilos)*, *Agent Map (Topología)*, *Ecosystem (Dashboard)* y *Telemetry (Costos/Tokens)*.

## Evidencia y decisiones

- Evidencia (código, 2026-10-23): `libs/studio-protocol` ya emite `Presence` (`agent`, `state`, `tool`, `threadId`), `WorkspaceSnapshot` (`project`, `specs`, `cycles`, `fixes`, `agents`, `pricing`) y `ThreadEvent` con `usage` (`tokensIn`, `tokensOut`, `costUsd`), permitiendo alimentar las tres nuevas vistas sin romper compatibilidad.
- Decisión del dev (2026-10-23): el orquestador principal lleva el nombre clave **Clara**. Flow `lite` para implementación ágil en un solo ciclo integral.
