## Sprint Plan — Ciclo 1 — studio-session-metadata

**Duración estimada:** 3.2 semanas (un dev, ~6 h efectivas/día)
**Story points totales:** 66  ·  **Horas totales:** 97

Orden: protocolo, puente, web. Incluye la enmienda 2026-10-26 (corte por seq) de architect.md. Verificación por task: la indicada, más `pnpm sdd:validate` al cerrar el ciclo.

**Camino crítico:** TASK-001 → TASK-005 → TASK-006 → TASK-010 → TASK-011 → TASK-012 → TASK-018 → TASK-020 → TASK-021 (con TASK-002 → TASK-008 → TASK-009 → TASK-011 en paralelo).

## Tasks Protocolo

### TASK-001: Protocolo: dominio de asociaciones múltiples y sessionTitle

**Historia:** US-1-001, US-2-001, US-4-001
**App:** libs/studio-protocol
**Descripción:** Agregar LinkOrigin, ThreadLinkRef, ThreadLinkEntry, ThreadLink.targets (opcional con .catch) y ThreadInfo.sessionTitle (nullable optional con .catch(null)); MAX_LINK_TARGETS en limits.ts.
**Archivos:** `libs/studio-protocol/src/domain.ts`, `libs/studio-protocol/src/limits.ts`, `libs/studio-protocol/src/domain.spec.ts`
**CA cubiertos:** CA-006, CA-007, CA-012, CA-022, CA-023
**Estimación:** 4h · **Story points:** 3
**Dependencias:** ninguna
**Verificación:** `pnpm --filter @sdd-studio/protocol test && pnpm --filter @sdd-studio/protocol typecheck`
**Criterio de done:**

- [ ] ThreadInfo v2 sin campos nuevos sigue parseando
- [ ] sessionTitle y targets malformados degradan con .catch sin tirar el frame
- [ ] Tests de domain.spec.ts verdes

### TASK-002: Protocolo: evento document.touched y tool.start.summaryTruncated

**Historia:** US-3-001
**App:** libs/studio-protocol
**Descripción:** Agregar el miembro document.touched (path, op, author) a ThreadEvent y summaryTruncated opcional a tool.start.
**Archivos:** `libs/studio-protocol/src/events.ts`, `libs/studio-protocol/src/events.spec.ts`
**CA cubiertos:** CA-013, CA-021, CA-023
**Estimación:** 3h · **Story points:** 2
**Dependencias:** ninguna
**Verificación:** `pnpm --filter @sdd-studio/protocol test && pnpm --filter @sdd-studio/protocol typecheck`
**Criterio de done:**

- [ ] document.touched valida path 1..1024 y op created|modified|deleted
- [ ] tool.start sin summaryTruncated sigue válido
- [ ] events.spec.ts verde

### TASK-003: Protocolo: comando thread.updateLinks, includeDocumentTouched y BRIDGE_FEATURES

**Historia:** US-2-001, US-4-001
**App:** libs/studio-protocol
**Descripción:** Agregar thread.updateLinks (add/remove de ThreadLinkRef, max 8, default []), thread.history.includeDocumentTouched (default false) y las features session-title, link-targets, document-touched al final de BRIDGE_FEATURES.
**Archivos:** `libs/studio-protocol/src/commands.ts`, `libs/studio-protocol/src/limits.ts`, `libs/studio-protocol/src/commands.spec.ts`, `libs/studio-protocol/src/handshake.spec.ts`
**CA cubiertos:** CA-005, CA-022, CA-023, CA-024, CA-025
**Estimación:** 3h · **Story points:** 2
**Dependencias:** TASK-001
**Verificación:** `pnpm --filter @sdd-studio/protocol test && pnpm --filter @sdd-studio/protocol typecheck`
**Criterio de done:**

- [ ] includeDocumentTouched omitido parsea a false
- [ ] handshake.spec.ts actualizado y PROTOCOL_VERSION === 2
- [ ] commands.spec.ts verde

## Tasks Puente

### TASK-004: Puente: resumen de Bash con rutas completas y summaryTruncated

**Historia:** US-3-001
**App:** apps/studio-bridge
**Descripción:** Implementar summarizeToolDetailed/summarizeBash (BASH_SUMMARY_MAX 600, cabeza ~360 + rutas sdd completas, sin saltos de línea), mantener summarizeTool como envoltorio y emitir summaryTruncated:true en tool.start.
**Archivos:** `apps/studio-bridge/src/engine/tool-summary.ts`, `apps/studio-bridge/src/engine/sdk-mapper.ts`, `apps/studio-bridge/src/engine/tool-summary.spec.ts`
**CA cubiertos:** CA-021
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-002
**Verificación:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`
**Criterio de done:**

- [ ] Comando largo conserva rutas sdd completas o termina en …
- [ ] Resumen sin saltos de línea y truncated reportado
- [ ] tool-summary.spec.ts verde

### TASK-005: Puente: álgebra pura de asociaciones (thread-link.ts)

**Historia:** US-2-001
**App:** apps/studio-bridge
**Descripción:** Implementar addManual, removeRef (descarte persistente), detectRef (colapso spec vs ciclo/fix, tope), detectRefs por ruta, legacyTargetOf y linkTargetExists ampliado a spec.
**Archivos:** `apps/studio-bridge/src/sessions/thread-link.ts`, `apps/studio-bridge/src/sessions/thread-link.spec.ts`
**CA cubiertos:** CA-006, CA-007, CA-009, CA-010, CA-011, CA-025
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-001
**Verificación:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`
**Criterio de done:**

- [ ] Descartada no reaparece por detección; manual no se reemplaza
- [ ] legacyTargetOf nunca devuelve spec
- [ ] thread-link.spec.ts verde

### TASK-006: Puente: StoredThread, migración de threads.json y archivo corrupto

**Historia:** US-2-001
**App:** apps/studio-bridge
**Descripción:** Agregar StoredLink/StoredThread con targets y sessionTitle, toThreadInfo (filtra descartadas), migración idempotente por hilo y renombre a threads.json.corrupt-<epoch> en lugar de sobrescribir.
**Archivos:** `apps/studio-bridge/src/sessions/store.ts`, `apps/studio-bridge/src/sessions/store.spec.ts`
**CA cubiertos:** CA-008, CA-009, CA-012
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-001, TASK-005
**Verificación:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`
**Criterio de done:**

- [ ] Migración idempotente sin pérdida de campos previos
- [ ] threads.json corrupto se renombra y no se pierde
- [ ] Descartadas no viajan en ThreadInfo
- [ ] store.spec.ts verde

### TASK-007: Puente: lectura de título de sesión en el motor (pickSessionTitle)

**Historia:** US-1-001
**App:** apps/studio-bridge
**Descripción:** Agregar readSessionTitle? a AgentEngine, sessionInfoFn inyectable y pickSessionTitle/cleanTitle (summary distinto de firstPrompt); spike de 10 min con sesión real en artifacts/spike-session-info.md que fija el criterio; título simulado en FakeEngine.
**Archivos:** `apps/studio-bridge/src/engine/types.ts`, `apps/studio-bridge/src/engine/claude-sdk-engine.ts`, `apps/studio-bridge/src/engine/fake-engine.ts`, `apps/studio-bridge/src/engine/claude-sdk-engine.spec.ts`, `sdd/specs/spec-e-burgos-007-studio-session-metadata/cycles/cycle-01/artifacts/spike-session-info.md`
**CA cubiertos:** CA-001, CA-002, CA-003
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-001
**Verificación:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`
**Criterio de done:**

- [ ] customTitle > summary distinto de firstPrompt > null
- [ ] Vacío o error devuelve null
- [ ] Spike documentado
- [ ] claude-sdk-engine.spec.ts verde

### TASK-008: Puente: DocumentChangeTracker (instantánea, diferencia y atribución)

**Historia:** US-3-001
**App:** apps/studio-bridge
**Descripción:** Módulo con instantánea de sdd/ por metadatos (presupuesto 20000 entradas / 250 ms), diferencia created|modified|deleted, ventanas por toolUseId, solapamientos y reglas de atribución, exclusión de recentExactTouches y tope 50 por tool.
**Archivos:** `apps/studio-bridge/src/sessions/document-tracker.ts`, `apps/studio-bridge/src/sessions/document-tracker.spec.ts`
**CA cubiertos:** CA-014, CA-015, CA-016
**Estimación:** 8h · **Story points:** 5
**Dependencias:** TASK-002
**Verificación:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`
**Criterio de done:**

- [ ] Crea/modifica/borra detectados en directorio temporal
- [ ] Sin cambios no produce nada; presupuesto excedido omite sin inventar
- [ ] Solapamiento mismo hilo y entre hilos según D-05
- [ ] document-tracker.spec.ts verde

### TASK-009: Puente: hooks de motor beforeTool/afterTool y marcadores del FakeEngine

**Historia:** US-3-001
**App:** apps/studio-bridge
**Descripción:** Agregar ToolRunContext y beforeTool/afterTool/rebaseTool/cancelTool a EngineCallbacks; en buildQueryOptions invocar beforeTool tras el veredicto del gate, registrar PostToolUse/PostToolUseFailure, rebase/cancel en canUseTool; marcadores #write-doc y #bash-doc en FakeEngine.
**Archivos:** `apps/studio-bridge/src/engine/types.ts`, `apps/studio-bridge/src/engine/claude-sdk-engine.ts`, `apps/studio-bridge/src/engine/fake-engine.ts`, `apps/studio-bridge/src/engine/claude-sdk-engine.spec.ts`
**CA cubiertos:** CA-013, CA-014, CA-017
**Estimación:** 6h · **Story points:** 3
**Dependencias:** TASK-007, TASK-008
**Verificación:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`
**Criterio de done:**

- [ ] Hooks llamados para Bash/Write/Edit/MultiEdit/NotebookEdit
- [ ] Denegado cierra la ventana sin registros
- [ ] FakeEngine escribe un archivo real con #write-doc y #bash-doc
- [ ] claude-sdk-engine.spec.ts verde

### TASK-010: Puente: SessionManager refresca y persiste sessionTitle

**Historia:** US-1-001
**App:** apps/studio-bridge
**Descripción:** Leer título en onSessionId, en cada turn.end y en backfill al arrancar (tope 20 hilos); un vuelo por hilo con race de 3 s, errores a reportError, publishThread solo si cambió.
**Archivos:** `apps/studio-bridge/src/sessions/session-manager.ts`, `apps/studio-bridge/src/sessions/session-manager.spec.ts`
**CA cubiertos:** CA-001, CA-002, CA-003, CA-004, CA-005
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-006, TASK-007
**Verificación:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`
**Criterio de done:**

- [ ] Fallo o timeout no interrumpe el hilo ni borra el último título
- [ ] Cambio publica thread.updated una sola vez
- [ ] session-manager.spec.ts verde con engine fake

### TASK-011: Puente: SessionManager emite document.touched, detecta asociaciones y filtra historial

**Historia:** US-3-001, US-2-001, US-4-001
**App:** apps/studio-bridge
**Descripción:** Integrar el tracker: afterTool emite document.touched por archivo, detectLinks por cada path con unresolvedPaths reintentado en turn.end, closeThreadWindows en finish, history(…, includeDocumentTouched) que filtra el evento por defecto.
**Archivos:** `apps/studio-bridge/src/sessions/session-manager.ts`, `apps/studio-bridge/src/sessions/session-manager.spec.ts`
**CA cubiertos:** CA-007, CA-013, CA-014, CA-015, CA-016, CA-023
**Estimación:** 8h · **Story points:** 5
**Dependencias:** TASK-003, TASK-005, TASK-006, TASK-009, TASK-010
**Verificación:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`
**Criterio de done:**

- [ ] Write/Edit/Bash producen document.touched y asociaciones detectadas existentes
- [ ] Historial sin includeDocumentTouched no contiene document.touched
- [ ] Ventana abierta al terminar el turno se cierra con diff final
- [ ] session-manager.spec.ts verde

### TASK-012: Puente: updateLinks, setLink legado y router

**Historia:** US-2-001, US-4-001
**App:** apps/studio-bridge
**Descripción:** Implementar thread.updateLinks atómico (remove luego add, not-found sin cambios, idempotente, publishThread), setLink como compatibilidad sobre targets y rutas thread.updateLinks y thread.history con la opción.
**Archivos:** `apps/studio-bridge/src/sessions/session-manager.ts`, `apps/studio-bridge/src/server/router.ts`, `apps/studio-bridge/src/sessions/session-manager.spec.ts`, `apps/studio-bridge/src/server/router.spec.ts`
**CA cubiertos:** CA-006, CA-008, CA-009, CA-010, CA-025
**Estimación:** 5h · **Story points:** 3
**Dependencias:** TASK-011
**Verificación:** `pnpm --filter @e-burgos/sdd-studio test && pnpm --filter @e-burgos/sdd-studio typecheck`
**Criterio de done:**

- [ ] add inexistente deja la lista intacta
- [ ] setLink legado no destruye las demás asociaciones
- [ ] router.spec.ts y session-manager.spec.ts verdes

## Tasks Web

### TASK-013: Web: ThreadState.touched, sameInfo con sessionTitle y bootstrap con includeDocumentTouched

**Historia:** US-3-001, US-1-001
**App:** apps/studio
**Descripción:** Agregar touched a ThreadState y emptyThread, case document.touched en applyThreadEvent (sin entrar en items), sameInfo compara sessionTitle y targets, thread.history con includeDocumentTouched true; actualizar literales de ThreadState en specs.
**Archivos:** `apps/studio/src/lib/store/timeline.ts`, `apps/studio/src/lib/store/state.ts`, `apps/studio/src/lib/bootstrap.ts`, `apps/studio/src/lib/store/timeline.spec.ts`, `apps/studio/src/lib/store/state.spec.ts`, `apps/studio/src/lib/bootstrap.spec.ts`
**CA cubiertos:** CA-004, CA-013, CA-022
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-001, TASK-002, TASK-003
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`
**Criterio de done:**

- [ ] seq <= lastSeq descartado también para touched
- [ ] document.touched no afecta items
- [ ] bootstrap.spec.ts verde

### TASK-014: Web: lib/link-targets y nav-tree con hilo bajo cada asociación

**Historia:** US-2-001, US-4-001
**App:** apps/studio
**Descripción:** Crear linkEntriesOf (deriva de link.target con puente viejo), isLinkEntryAvailable y etiquetas; buildNavTree coloca el hilo bajo cada entrada activa (spec en Sin ciclo).
**Archivos:** `apps/studio/src/lib/link-targets.ts`, `apps/studio/src/lib/link-targets.spec.ts`, `apps/studio/src/lib/store/nav-tree.ts`, `apps/studio/src/lib/store/nav-tree.spec.ts`
**CA cubiertos:** CA-006, CA-011, CA-022
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-001
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`
**Criterio de done:**

- [ ] Puente viejo deriva una sola entrada
- [ ] Entrada inexistente marcada no disponible
- [ ] nav-tree.spec.ts y link-targets.spec.ts verdes

### TASK-015: Web: useBridgeFeatures, CapabilityNotice e i18n

**Historia:** US-4-001
**App:** apps/studio
**Descripción:** Hook supports(session-title|link-targets|document-touched) sobre client.supports y aviso no bloqueante con claves i18n nuevas sin reordenar.
**Archivos:** `apps/studio/src/lib/use-bridge-features.ts`, `apps/studio/src/components/mission-control/CapabilityNotice.tsx`, `apps/studio/src/lib/i18n/en.ts`, `apps/studio/src/lib/i18n/es.ts`, `apps/studio/src/components/handshake-features.spec.tsx`
**CA cubiertos:** CA-022, CA-024
**Estimación:** 3h · **Story points:** 2
**Dependencias:** TASK-003
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`
**Criterio de done:**

- [ ] Puente viejo muestra aviso sin bloquear
- [ ] Puente nuevo no muestra aviso
- [ ] handshake-features.spec.tsx verde

### TASK-016: Web: conversation.ts con corte por seq (enmienda)

**Historia:** US-3-001
**App:** apps/studio
**Descripción:** Calcular cutoffSeq = min(seq) de touched; relatedDocuments con beforeSeq opcional, structuredDocuments sobre touched, fusión por ruta entre tramos, op, documentSource structured|heuristic|mixed y sessionTitle en ConversationView.
**Archivos:** `apps/studio/src/lib/conversation.ts`, `apps/studio/src/lib/conversation.spec.ts`
**CA cubiertos:** CA-017, CA-018, CA-019, CA-020
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-013
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`
**Criterio de done:**

- [ ] Sin touched usa solo heurística idéntica a hoy
- [ ] Eventos con seq menor al corte usan heurística y posteriores solo estructurado
- [ ] Misma ruta en ambos tramos aparece una vez
- [ ] conversation.spec.ts cubre corte, fusión, sin toques y solo estructurado

### TASK-017: Web: ConversationSessionInfo y RelatedDocuments

**Historia:** US-1-001, US-3-001, US-4-001
**App:** apps/studio
**Descripción:** Mostrar el título en tres estados (título, sin título disponible, puente desactualizado) y la operación y fuente en los documentos relacionados.
**Archivos:** `apps/studio/src/components/mission-control/ConversationSessionInfo.tsx`, `apps/studio/src/components/mission-control/RelatedDocuments.tsx`, `apps/studio/src/components/mission-control/ConversationSessionInfo.spec.tsx`, `apps/studio/src/components/mission-control/RelatedDocuments.spec.tsx`
**CA cubiertos:** CA-001, CA-002, CA-003, CA-004, CA-022, CA-024
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-015, TASK-016
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`
**Criterio de done:**

- [ ] Tres estados del título renderizados
- [ ] RelatedDocuments muestra op cuando existe
- [ ] Specs de ambos componentes verdes

### TASK-018: Web: ThreadLinkPicker multi-asociación y paneles

**Historia:** US-2-001, US-4-001
**App:** apps/studio
**Descripción:** Lista de chips con origen, estado no disponible, quitar y agregar vía thread.updateLinks cuando hay link-targets (fallback single-select con thread.setLink); integrar CapabilityNotice en los paneles.
**Archivos:** `apps/studio/src/components/workspace/ThreadLinkPicker.tsx`, `apps/studio/src/components/workspace/ConversationPanelSections.tsx`, `apps/studio/src/components/workspace/RightPanel.tsx`, `apps/studio/src/components/workspace/threadlink.spec.tsx`
**CA cubiertos:** CA-006, CA-007, CA-009, CA-010, CA-011, CA-025
**Estimación:** 6h · **Story points:** 5
**Dependencias:** TASK-012, TASK-014, TASK-015
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`
**Criterio de done:**

- [ ] Agregar y quitar usan updateLinks con link-targets y setLink sin él
- [ ] Chips muestran origen y no disponible
- [ ] threadlink.spec.tsx verde

### TASK-019: Web: indicador summaryTruncated en Timeline y no-fabricated-data

**Historia:** US-3-001, US-4-001
**App:** apps/studio
**Descripción:** Mostrar indicador de recorte con summaryTruncated o, sin el campo, por … final; verificar no-fabricated-data.
**Archivos:** `apps/studio/src/components/workspace/Timeline.tsx`, `apps/studio/src/lib/no-fabricated-data.spec.ts`
**CA cubiertos:** CA-021, CA-022
**Estimación:** 3h · **Story points:** 2
**Dependencias:** TASK-002, TASK-004, TASK-013
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck`
**Criterio de done:**

- [ ] Indicador visible solo cuando hay recorte
- [ ] no-fabricated-data.spec.ts verde

### TASK-020: Web: e2e Playwright con engine fake (#bash-doc)

**Historia:** US-3-001
**App:** apps/studio
**Descripción:** Escenario e2e con --engine fake: #bash-doc produce documentos tocados en la conversación; hilo sin cambios no produce ninguno.
**Archivos:** `apps/studio/e2e/session-metadata.spec.ts`
**CA cubiertos:** CA-014, CA-015, CA-016, CA-018
**Estimación:** 4h · **Story points:** 3
**Dependencias:** TASK-011, TASK-017, TASK-018, TASK-019
**Verificación:** `pnpm --filter sdd-studio-web test && pnpm --filter sdd-studio-web typecheck && pnpm --filter sdd-studio-web e2e`
**Criterio de done:**

- [ ] e2e verde localmente
- [ ] Sin tokens reales consumidos

## Task integral

### TASK-021: Integral: build, typecheck y test del workspace

**Historia:** US-1-001, US-2-001, US-3-001, US-4-001
**App:** libs/studio-protocol, apps/studio-bridge, apps/studio
**Descripción:** Verificación final de los tres subproyectos y limpieza de residuos.
**Archivos:** ninguno (verificación)
**CA cubiertos:** CA-026
**Estimación:** 3h · **Story points:** 2
**Dependencias:** TASK-020
**Verificación:** `pnpm build && pnpm typecheck && pnpm test`
**Criterio de done:**

- [ ] pnpm build && pnpm typecheck && pnpm test en verde
- [ ] sin apps/studio/next-env.d.ts en el diff

## Notas del implementador

- `threads.json` que no se puede leer por un error distinto de ENOENT (permisos, I/O) sigue haciendo fallar `ThreadStore.init()`: el puente no arranca en lugar de sobrescribir un archivo que no pudo leer. Solo el contenido inválido (JSON roto o no arreglo) se pone en cuarentena como `threads.json.corrupt-<epoch>`.
- `AgentEngine.readSessionTitle` rechaza ante un fallo de lectura y devuelve `null` solo cuando el SDK confirma que no hay título; `SessionManager` ignora el fallo (a `reportError`) y conserva el último título conocido.
