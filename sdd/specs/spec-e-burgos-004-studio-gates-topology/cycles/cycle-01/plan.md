# spec-e-burgos-004-studio-gates-topology — cycle-01 · plan (lite)

> Módulo: studio-gates-topology | Subproyectos: apps/studio | Fecha: 2026-10-24
> Objetivo: Visualizar de forma interactiva en el `AgentMapCanvas` las 6 GATES del kit SDD (Regla Cero, Spec Gate A, Spec Gate B, Contexto Gate, Fix Gate, Memoria Gate) como tarjetas/puertas a la izquierda del diagrama, conectadas con los agentes del enjambre mediante arcos reactivos; y transformar el `AgentInspectorDrawer` en un panel dividido (Split-view) que comparte la ficha del agente con su feed de conversación en tiempo real y respuesta directa.

## Historias

- US-1 — Como desarrollador quiero ver las 6 GATES de la metodología SDD (Regla Cero, Gate A, Gate B, Contexto Gate, Fix Gate, Memoria Gate) representadas como tarjetas interactivas ("puertas") a la izquierda del mapa de topología en `AgentMapCanvas`. CA: `gates.ts` define los 6 gates con título, descripción, icono de puerta, criterio de verificación y estado reactivo (`PASSING`, `ACTIVE`, `IDLE`, `BLOCKED`); las tarjetas se renderizan dentro del lienzo SVG/HTML a la izquierda del enjambre conmutables entre Gates del Ciclo y Gates Transversales.
- US-2 — Como desarrollador quiero que el diagrama muestre visualmente las interconexiones entre los agentes del enjambre y las GATES que operan o auditan. CA: Arcos SVG animados comunican a Clara/Mercurio con Gate A, Sophia/Chronos/Daedalus/Vulcan/Aurora con Gate B, Argus con Contexto Gate y Memoria Gate, y Jarvis con Fix Gate y Regla Cero.
- US-3 — Como desarrollador quiero un panel dividido vertical (Split-View) en el inspector lateral (`AgentInspectorDrawer`) que contenga la ficha técnica del agente arriba y la conversación en tiempo real abajo. CA: La sección superior conserva avatar, rol, estado y herramientas; la sección inferior muestra el feed en vivo con mensajes intercambiados por el agente, indicador de streaming y un input rápido para interactuar con él.
- US-4 — Como desarrollador quiero pulsar en una tarjeta de Gate para abrir su ficha de inspección técnica con sus reglas, estado y comando CLI. CA: Drawer o panel de inspección de Gate que muestra criterios de aprobación, comando (`pnpm sdd:gate`) y agentes vinculados.
- US-5 — Como desarrollador quiero una suite de tests unitarios y de componentes actualizada para validar la topología de Gates y el chat dividido sin regresiones. CA: `vitest` ejecuta y aprueba todas las pruebas de `AgentMapCanvas`, `AgentInspectorDrawer` y `gates.ts`.

## Tasks (detalle en tasks.json)

- TASK-001 — Catálogo y tipado de GATES en `apps/studio/src/lib/gates.ts` con las 6 puertas (Regla Cero, Gate A, Gate B, Contexto, Fix, Memoria), reglas, estados y tests unitarios.
- TASK-002 — Componentes `GateCard` / `GateNode` y renderizado de las 4 ranuras activas + selector para las 6 puertas a la izquierda del lienzo en `AgentMapCanvas.tsx`.
- TASK-003 — Conexiones SVG interactivas (edges) entre los agentes y las puertas del enjambre con efectos de pulso y resplandor al activarse.
- TASK-004 — Reestructuración de `AgentInspectorDrawer.tsx` en Split-View con cabecera de perfil arriba y feed de conversación en vivo abajo (`LiveAgentChatFeed`).
- TASK-005 — Panel de detalle e inspección de Gates (`GateInspectorDrawer.tsx`) con criterios, reglas y comando `sdd:gate`.
- TASK-006 — Actualizaciones de i18n (`es.ts`, `en.ts`), suite completa de tests de componentes y verificación 100% verde en `vitest`.

## Decisiones técnicas

- Sin cambios en el protocolo WebSocket: se extraen las conversaciones y eventos en tiempo real a partir de `threads` y `presence` que ya emite `@sdd-studio/protocol`, vinculando mensajes por agente emisor y receptor.
- Coordenadas SVG unificadas: las tarjetas de Gates se integran en el sistema de coordenadas de `AgentMapCanvas` (x: 40 a 260) para garantizar que las líneas SVG de conexión se dibujen de manera fluida y responsiva junto con los nodos del enjambre.
- Split-View en `AgentInspectorDrawer`: se amplía sutilmente el ancho del drawer a `w-96` o `w-[420px]` con flexbox vertical (`flex flex-col h-full`) para dar espacio generoso al chat en vivo sin sacrificar legibilidad.
