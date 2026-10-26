# Sprint Plan — Cycle 1: studio-session-ux

> **Input:** sdd/specs/spec-e-burgos-001-studio-session-ux/cycles/cycle-01/functional.md
> **Output:** sdd/specs/spec-e-burgos-001-studio-session-ux/cycles/cycle-01/planner.md
> **Generado por:** sdd-planner
> **Revisión:** 2026-10-23 (2ª) — corte aprobado por el dev: cycle-01 = HU-4..HU-10 + contratos de toda la spec; HU-1..HU-3 pasan a cycle-02 (architect.md §0.1, §6).

---

## Resumen del ciclo

| Campo | Valor |
| ----- | ----- |
| Ciclo | 1 |
| Módulo | studio-session-ux |
| Tasks | 37 (en tasks.json) |
| Estimación total | 139h · 165 SP (~3.5 semanas de un dev a 40h) |
| Subproyectos | libs/studio-protocol, apps/studio-bridge, apps/studio |
| Alcance | HU-4, HU-5, HU-6, HU-7, HU-8, HU-9, HU-10 + contratos de HU-1..HU-3 |

| Fase | Tasks | Horas | SP |
| ---- | ----- | ----- | -- |
| F1 — Protocolo (libs/studio-protocol) | 6 | 20h | 22 |
| F2 — Puente (apps/studio-bridge) | 14 | 60h | 75 |
| F3 — Web (apps/studio) | 17 | 59h | 68 |

Escala de SP: ≤1h→1 · 2h→2 · 3h→3 · 4h→5 · >5h→8. Ninguna task supera 6h. Implementador: **back** = sdd-implementor-back (protocolo y puente), **front** = sdd-implementor-front (web). FIX-e-burgos-002 ya está commiteado: no hay precondición.

**Advertencia de tamaño:** 139h exceden el objetivo de 2 semanas del brief si trabaja un solo implementador. F3 puede arrancar en paralelo con F2 contra el FakeEngine (TASK-011) apenas F1 está en verde, y el camino crítico back es F1 (20h) + F2 (60h) = 80h, unas 2 semanas de calendario con back y front en paralelo. El dev ya aprobó este corte; si se necesita recortar más, el candidato es TASK-033 (borrador por hilo) hacia cycle-02, no los contratos de F1.

## Checkpoints entre fases (tests en verde)

- Fin F1 (TASK-006): `pnpm nx run-many -t lint test build -p studio-protocol`; PROTOCOL_VERSION = 2, único bump.
- Fin F2 (TASK-019): `pnpm nx run-many -t lint test build -p studio-bridge`.
- Fin F3 (TASK-037): `pnpm build && pnpm typecheck && pnpm test` (los tres proyectos).

## Dependencias de decisiones abiertas

- **Spike de PostToolBatch (TASK-007):** TASK-009, 010 y 013 dependen de su resultado (deliveryMode stream | hook-context); el protocolo no cambia en ningún caso (R11). Si el spike falla ambos caminos, se replanifica F2.
- El Arquitecto ya cerró contratos de adjuntos, búsqueda, catálogo, vínculo y scope de Always (architect.md §1, §2); no quedan decisiones pendientes que bloqueen tasks.

## Tasks por fase

## F1 — Protocolo (libs/studio-protocol)

### TASK-001: limits.ts, handshake con features y PROTOCOL_VERSION = 2

- **Subproyecto:** libs/studio-protocol · **Implementador:** sdd-implementor-back
- **Historia:** HU-10 · **CA:** CA-013
- **Descripción:** Crear limits.ts (MAX_FRAME_BYTES, FRAME_BUDGET_BYTES, MAX_ATTACHMENTS, IMAGE_MAX_SIDE, MAX_PROMPT_REFS, FILE_SEARCH_MAX, MAX_PENDING_PER_THREAD, BRIDGE_FEATURES, TEXT_ATTACHMENT_EXTENSIONS); Welcome.features y HandshakeError.bridgeProtocolVersion/bridgeVersion opcionales; único bump de PROTOCOL_VERSION (D-01).
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** ninguna
- **Criterio de done:**
  - [ ] Un solo bump en todo el ciclo
  - [ ] Forma de Hello/HandshakeError compatible con un cliente v1
  - [ ] Specs zod en verde

### TASK-002: Contrato attachments.ts (solo contrato para cycle-02)

- **Subproyecto:** libs/studio-protocol · **Implementador:** sdd-implementor-back
- **Historia:** HU-1, HU-2, HU-3 · **CA:** CA-001, CA-004, CA-005
- **Descripción:** AttachmentUpload, AttachmentRef, PromptRefs, CatalogId, AttachmentContent, EXT_BY_MIME y Sha256 (§2.3) con specs de parseo válido/inválido.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-001
- **Criterio de done:**
  - [ ] Schemas exportados con su type z.infer
  - [ ] Specs de límites (5 adjuntos, base64, dimensiones)

### TASK-003: domain.ts: ThreadLink, ThreadInfo.link/pendingCount, AlwaysRule y AlwaysOffer

- **Subproyecto:** libs/studio-protocol · **Implementador:** sdd-implementor-back
- **Historia:** HU-4, HU-6 · **CA:** CA-006, CA-008
- **Descripción:** Tipos de §2.4 incluyendo SpecIdValue, CycleIdValue, FixIdValue; PermissionModeChoice intacto (FIX-002).
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-001
- **Criterio de done:**
  - [ ] ThreadInfo requiere link y pendingCount
  - [ ] AlwaysOffer none con reason gate-warning|not-calculable
  - [ ] Specs en verde

### TASK-004: commands.ts: MessageBody, pending.*, setLink, searchFiles, attachment.get, SendResult, FileSearchResult

- **Subproyecto:** libs/studio-protocol · **Implementador:** sdd-implementor-back
- **Historia:** HU-10, HU-4, HU-2 · **CA:** CA-013, CA-014, CA-006
- **Descripción:** Comandos de §2.5 con hasContent (texto o adjunto), SendResult y FileSearchResult exportados.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-002, TASK-003
- **Criterio de done:**
  - [ ] thread.send/create aceptan adjuntos y refs por defecto vacíos
  - [ ] Comandos pending.edit/remove/flush y setLink parsean
  - [ ] Specs en verde

### TASK-005: events.ts y snapshot.ts: pending.*, user.message extendido, approval always/remembered, catálogo y fechas de fixes

- **Subproyecto:** libs/studio-protocol · **Implementador:** sdd-implementor-back
- **Historia:** HU-10, HU-6, HU-4, HU-3 · **CA:** CA-013, CA-008, CA-006
- **Descripción:** Eventos pending.added/edited/removed/reverted; user.message con pendingId/delivery/attachments/refs; approval.requested.always y approval.resolved.remembered; AgentSummary.source/path, SkillSummary, FixSummary.createdAt/closedAt y snapshot.skills.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-003
- **Criterio de done:**
  - [ ] Campos nuevos dentro de ThreadEvent son opcionales
  - [ ] Specs de compatibilidad con líneas JSONL viejas

### TASK-006: Checkpoint de F1: compatibilidad y verificación de la lib

- **Subproyecto:** libs/studio-protocol · **Implementador:** sdd-implementor-back
- **Historia:** HU-10 · **CA:** CA-013
- **Descripción:** Revisar que todos los contratos de la spec están publicados, specs de JSONL viejos y de contratos de cycle-02, exports del index, typecheck y build.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-001, TASK-002, TASK-003, TASK-004, TASK-005
- **Criterio de done:**
  - [ ] pnpm nx run-many -t lint test build -p studio-protocol en verde
  - [ ] Contratos de cycle-02 con spec zod (R10)

## F2 — Puente (apps/studio-bridge)

### TASK-007: Spike e2e: entrega en punto de corte con PostToolBatch (SDK 0.3.292 real)

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-10 · **CA:** CA-013
- **Descripción:** Turno haiku/low con dos rondas de tools; empujar un pendiente en el primer PostToolBatch y afirmar que su uuid aparece en user_message_uuids del mismo result y que la respuesta lo contempla; decidir deliveryMode stream | hook-context (D-21, R11).
- **Estimación:** 6h · **Story points:** 8
- **Dependencias:** TASK-006
- **Criterio de done:**
  - [ ] Resultado del spike documentado con el default elegido
  - [ ] Spec e2e con skip explícito sin credenciales

### TASK-008: InputChannel y prompt-content

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-10 · **CA:** CA-013
- **Descripción:** engine/input-channel.ts (push, pushAndFlush, end) y engine/prompt-content.ts (toSdkUserMessage con uuid) con specs.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-006
- **Criterio de done:**
  - [ ] pushAndFlush resuelve cuando el consumidor pide el siguiente
  - [ ] Specs en verde

### TASK-009: Engine: prompt streaming, resultado, interrupt con recibo

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-10 · **CA:** CA-013, CA-015
- **Descripción:** QueryFn con AsyncIterable en todos los turnos; al result entregar pendientes o end(); interrupt con still_queued y revertPending + abort; resume intacto; bloque bypass de FIX-002 conservado (D-06).
- **Estimación:** 6h · **Story points:** 8
- **Dependencias:** TASK-007, TASK-008
- **Criterio de done:**
  - [ ] Mensaje solo texto sin regresión
  - [ ] Interrupt revierte los no entregados
  - [ ] Resume funciona

### TASK-010: Hook PostToolBatch y modo de entrega según el spike

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-10 · **CA:** CA-013
- **Descripción:** Hook solo hilo principal: collectPending(cut-point), pushAndFlush y emisión de user.message con delivery; fallback additionalContext si el spike lo exige.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-007, TASK-009
- **Criterio de done:**
  - [ ] Pendiente llega antes del siguiente request al modelo
  - [ ] Subagentes no entregan

### TASK-011: FakeEngine con puntos de corte y marcadores

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-10, HU-6 · **CA:** CA-013, CA-008
- **Descripción:** D-07: input.prompts, #steps:N, heard:, #revert y marcadores de Always (#mcp, #edit-tool, #bash-git, #bash-git2, #bash-chain).
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-008
- **Criterio de done:**
  - [ ] Marcadores existentes sin cambios
  - [ ] Specs del fake en verde

### TASK-012: store.ts: pending persistido y migración de link/pending

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-10, HU-4 · **CA:** CA-013, CA-006
- **Descripción:** StoredThread.pending, toInfo con pendingCount, init() completa link legacy y pending vacío.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-006
- **Criterio de done:**
  - [ ] threads.json viejo se migra
  - [ ] Los pendientes se recargan tras reinicio sin auto-enviarse

### TASK-013: SessionManager: pendientes, send/SendResult, edit/remove/flush

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-10 · **CA:** CA-013, CA-014, CA-015
- **Descripción:** send deja de lanzar conflict por hilo ocupado; collectPending/revertPending; finish() entrega solo en fin normal; límite de 10; decisiones síncronas (D-20, D-21).
- **Estimación:** 6h · **Story points:** 8
- **Dependencias:** TASK-009, TASK-011, TASK-012
- **Criterio de done:**
  - [ ] Pendiente editable/removible solo hasta entregarse
  - [ ] Error e interrupt no auto-envían
  - [ ] 11º pendiente da conflict

### TASK-014: Router y ws-server: comandos nuevos, unsupported, features, maxPayload

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-10, HU-4 · **CA:** CA-013, CA-006
- **Descripción:** Casos de §2.5; searchFiles y attachment.get responden bad-request unsupported; Welcome.features con pending-messages, thread-link, always-rules; maxPayload del protocolo; HandshakeError con versiones.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-006, TASK-013
- **Criterio de done:**
  - [ ] Un puente de cycle-01 no anuncia attachments/file-search/catalog
  - [ ] Mensaje de protocol mismatch explícito

### TASK-015: always-rule.ts: alwaysOfferOf, bashPrefixOf, matchesRule

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-6 · **CA:** CA-008, CA-009
- **Descripción:** Reglas por herramienta, tool MCP y prefijo Bash con la tabla de D-14; compuestos, envoltorios y asignaciones no calculables.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-003
- **Criterio de done:**
  - [ ] Tabla de ejemplos de D-14 cubierta
  - [ ] git status && rm -rf x nunca matchea git status

### TASK-016: Always en SessionManager y aprobaciones

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-6 · **CA:** CA-008, CA-009
- **Descripción:** Live.alwaysAllow como AlwaysRule[]; approval.requested.always; approval.resolved.remembered; con gateWarning no se guarda regla; deny bloquea antes de mirar reglas; scope thread con none se trata como once.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-013, TASK-015
- **Criterio de done:**
  - [ ] Gate warn siempre pregunta
  - [ ] Otra tool del mismo servidor MCP sigue preguntando
  - [ ] Regla solo vive con el hilo

### TASK-017: assignLink, thread.setLink y link en createThread

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-4 · **CA:** CA-006
- **Descripción:** Auto-asignación D-11 (ciclo in-progress, fix abierto, none), manual, thread.updated a todas las pestañas, not-found conserva el vínculo.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-013
- **Criterio de done:**
  - [ ] Hilo legacy queda con link none/legacy
  - [ ] Destino inexistente no cambia el vínculo

### TASK-018: Snapshot: source/path de agentes, skills vacío, fechas de fixes

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-4, HU-3 · **CA:** CA-006
- **Descripción:** loadAgents con source y path, skills: [], FixSummary.createdAt/closedAt, AREA_FIELDS.agents con skills.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-005
- **Criterio de done:**
  - [ ] Snapshot valida contra el protocolo
  - [ ] Fechas null cuando no existen

### TASK-019: Tests del puente: pendientes y entrega

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-10 · **CA:** CA-013, CA-014, CA-015
- **Descripción:** Specs de SessionManager y router con FakeEngine: CA-013.1..013.6, CA-014, CA-015.1..015.5 (waiting-approval, interrupt, error, reinicio).
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-013, TASK-014
- **Criterio de done:**
  - [ ] CA-013, CA-014, CA-015 cubiertos en el puente

### TASK-020: Tests del puente: Always, vínculo y snapshot

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-6, HU-4 · **CA:** CA-008, CA-009, CA-006
- **Descripción:** Specs de CA-008.1..008.6, CA-009.1..009.4, asignación y reasignación de vínculo y snapshot; checkpoint de F2.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-016, TASK-017, TASK-018
- **Criterio de done:**
  - [ ] pnpm nx run-many -t lint test build -p studio-bridge en verde

## F3 — Web (apps/studio)

### TASK-021: client.ts: guarda de frame y mensajes de versión

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-10 · **CA:** CA-015
- **Descripción:** Rechazo local frame-too-large sin enviar; mensajes de protocol-mismatch según bridgeProtocolVersion; lectura de Welcome.features.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-014
- **Criterio de done:**
  - [ ] Nunca se envía un frame mayor a MAX_FRAME_BYTES
  - [ ] Textos i18n es/en

### TASK-022: nav-tree.ts: buildNavTree puro

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-4, HU-5 · **CA:** CA-006, CA-007, CA-016
- **Descripción:** Secciones HILOS ACTIVOS, CANALES (sin spec:*), SPECS, FIXES, AGENTES; ubicación D-13; top 5 de fixes cerrados y Fixes anteriores; containsSelection y needsAttention.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-018
- **Criterio de done:**
  - [ ] Cada hilo aparece una sola vez
  - [ ] CANALES sin canales spec:*
  - [ ] Specs de la función pura

### TASK-023: Selector activeThreads

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-7 · **CA:** CA-010
- **Descripción:** Orden waiting-approval, running, queued y luego lastActivity; datos de pendingCount.
- **Estimación:** 2h · **Story points:** 2
- **Dependencias:** TASK-022
- **Criterio de done:**
  - [ ] Orden y filtrado verificados

### TASK-024: useCollapsedState con localStorage

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-5 · **CA:** CA-007
- **Descripción:** Clave sdd-studio.sidebar.v1:<project>, validación zod, inválido vuelve a defaults, poda a 500, sync por evento storage.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-022
- **Criterio de done:**
  - [ ] Estado inválido no produce error
  - [ ] Overrides sobreviven a recarga

### TASK-025: Sidebar: árbol SPECS/FIXES colapsable

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-4, HU-5 · **CA:** CA-006, CA-007, CA-016
- **Descripción:** Render del árbol con encabezados button aria-expanded, estados vacíos, selección y apertura de hilos, teclas izquierda/derecha; Next 16 / React 19.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-022, TASK-024
- **Criterio de done:**
  - [ ] CA-006.1..006.3, 006.7, 006.8
  - [ ] CA-007.1..007.4
  - [ ] CA-016.1

### TASK-026: Sección Hilos activos

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-7 · **CA:** CA-010
- **Descripción:** Lista con título, agente, estado y pendientes; navegación entre canales; Sin hilos activos; aviso de datos posiblemente desactualizados sin conexión; atención visible en colapsados.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-023, TASK-025
- **Criterio de done:**
  - [ ] CA-010.1..010.7
  - [ ] CA-007.5

### TASK-027: ThreadLinkPicker en el header del hilo

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-4 · **CA:** CA-006
- **Descripción:** Selector de destino (ciclos, fixes, ninguno) con thread.setLink y error visible.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-017, TASK-025
- **Criterio de done:**
  - [ ] CA-006.5 y CA-006.11

### TASK-028: ActivityIndicator y AgentAvatar con estado

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-8 · **CA:** CA-011
- **Descripción:** Typing dots, escudo/pausa y reloj, slot fijo sin layout shift, motion-safe, corrección de Sidebar animate-pulse.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-023
- **Criterio de done:**
  - [ ] CA-011.1..011.6

### TASK-029: useStickToBottom y correcciones del hilo (S1-S3)

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-9 · **CA:** CA-012
- **Descripción:** ResizeObserver, key=threadId, scroll al sincronizar, JumpToLatest, umbral 48 px, envío propio fuerza fondo; polyfill de ResizeObserver en vitest; registrar los casos reproducidos antes de corregir.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** ninguna
- **Criterio de done:**
  - [ ] CA-012.1..012.4, 012.7

### TASK-030: Layout y scroll del Sidebar y Workspace (S4-S6)

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-9 · **CA:** CA-012
- **Descripción:** Sidebar con header/pie fijos y árbol scrolleable, grid-rows-[minmax(0,1fr)], paneles sin scroll doble.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-025, TASK-026
- **Criterio de done:**
  - [ ] CA-012.5, 012.6

### TASK-031: Estado de pendientes y flujo de envío

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-10 · **CA:** CA-013, CA-015
- **Descripción:** ThreadState.pending reducido desde pending.* y user.message.pendingId; uso de SendResult; recarga y otras pestañas; "no llegó al modelo" tras pending.reverted.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-021, TASK-023
- **Criterio de done:**
  - [ ] CA-013.4, 013.6
  - [ ] CA-015.2, 015.4

### TASK-032: Bandeja PendingMessages y Composer "Encolar"

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-10 · **CA:** CA-013, CA-014, CA-015
- **Descripción:** Bandeja sobre el Composer con editar inline, quitar, Pendiente/Entregado, errores de carrera y rótulos distintos del estado queued del hilo.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-031
- **Criterio de done:**
  - [ ] CA-013.1, 013.2, 014.1..014.4, 015.5

### TASK-033: Borrador de texto por hilo

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-10 · **CA:** CA-016
- **Descripción:** Slice drafts en zustand (threadId o new:<channelId>), Composer inicializa y escribe el borrador; se descarta al enviar y se pierde al recargar.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** ninguna
- **Criterio de done:**
  - [ ] CA-016.2, 016.3

### TASK-034: ApprovalCard con regla Always

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-6 · **CA:** CA-008, CA-009
- **Descripción:** Mostrar la regla que recordaría Always, ocultar el botón con always none y explicar la razón, mostrar remembered; textos i18n.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-016
- **Criterio de done:**
  - [ ] CA-008.4
  - [ ] CA-009.3

### TASK-035: Tests web: navegación

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-4, HU-5, HU-7 · **CA:** CA-006, CA-007, CA-010
- **Descripción:** Specs de nav-tree, colapso, Sidebar, activos y ThreadLinkPicker.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-026, TASK-027
- **Criterio de done:**
  - [ ] Cobertura de CA-006, 007, 010 en UI

### TASK-036: Tests web: indicadores, scroll y aprobación

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-6, HU-8, HU-9 · **CA:** CA-008, CA-011, CA-012
- **Descripción:** Specs de ActivityIndicator con prefers-reduced-motion, useStickToBottom y ApprovalCard.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-028, TASK-029, TASK-030, TASK-034
- **Criterio de done:**
  - [ ] CA-011.4, CA-012.1..012.3, CA-008.4

### TASK-037: Tests web: pendientes, borrador y guarda de frame; checkpoint final

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-10 · **CA:** CA-013, CA-014, CA-016
- **Descripción:** Specs del reducer, bandeja, drafts y client.ts; pnpm build && pnpm typecheck && pnpm test del workspace.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-021, TASK-031, TASK-032, TASK-033
- **Criterio de done:**
  - [ ] pnpm build && pnpm typecheck && pnpm test en verde

## Orden de ejecución y camino crítico

TASK-001 → 002 → 003 → (004, 005) → 006 → F2: 007 (spike) ∥ 008 ∥ 012 ∥ 015 ∥ 018 → 009 → 010 / 011 → 013 → 014, 016, 017 → 019 → F3 (F3 puede iniciar en paralelo desde TASK-021, 022, 029 y 033 con F1 en verde y el FakeEngine).

Camino crítico: 001 → 002/003 → 004 → 006 → 007 → 009 → 010 → 013 → 014 → 021 → 031 → 032 → 037. Las tasks front que consumen un contrato del puente (021, 022, 027, 034) no empiezan antes de su task back.

## Backlog cycle-02 (HU-1, HU-2, HU-3 — no está en tasks.json)

Se desglosará al abrir cycle-02 sobre los contratos ya publicados, sin bump de versión. Estimación previa:

| Subproyecto | Task prevista | HU | Horas |
| ----------- | ------------- | -- | ----- |
| Puente | Adjuntos: attachment-store (sha256, dedupe, escritura atómica) y revalidación por magic bytes/UTF-8 | HU-1 | 4h |
| Puente | Mapeo de adjuntos y refs a bloques image/document/text del SDK y preámbulo | HU-1, HU-3 | 4h |
| Puente | attachment.get y servido al recargar | HU-1 | 3h |
| Puente | file-index y workspace.searchFiles (git ls-files, exclusiones, ranking) | HU-2 | 5h |
| Puente | Catálogo completo de agentes/skills/prompts y watcher de .claude | HU-3 | 5h |
| Puente | Features attachments/file-search/catalog y retiro de unsupported | HU-1, HU-2, HU-3 | 2h |
| Puente | Tests de adjuntos, búsqueda y catálogo | HU-1, HU-2, HU-3 | 4h |
| Web | Composer: selección, pegado, arrastre y preview de adjuntos | HU-1 | 4h |
| Web | Re-encode siempre, escalera de presupuesto y borrador con adjuntos | HU-1 | 6h |
| Web | Render de adjuntos en timeline, attachment.get, LRU de objectURL | HU-1 | 4h |
| Web | MentionMenu @ de archivos y agentes | HU-2, HU-3 | 5h |
| Web | Menú / de comandos y skills y envío de refs | HU-3 | 4h |
| Web | Tests del Composer (adjuntos, menús, EXIF) | HU-1, HU-2, HU-3 | 4h |

Total previsto: 54h (~1.4 semanas).

## Riesgos que afectan al plan

- R3/R9/R11 (TASK-007, 009, 010, 013): el streaming y la entrega en corte concentran el riesgo de F2; el spike va primero.
- R10 (TASK-002, 004, 005, 006): contratos de cycle-02 sin consumidor; specs zod y unsupported explícito en el puente.
- R8 (F3): el implementor front verifica la API de Next 16.4.3 / React 19.3.0, no la del contexto desactualizado.
