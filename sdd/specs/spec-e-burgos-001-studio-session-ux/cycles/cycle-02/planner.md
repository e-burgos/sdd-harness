# Sprint Plan — Cycle 2: studio-session-ux

> **Input:** sdd/specs/spec-e-burgos-001-studio-session-ux/cycles/cycle-02/functional.md, architect.md, brief.yaml
> **Output:** sdd/specs/spec-e-burgos-001-studio-session-ux/cycles/cycle-02/planner.md
> **Generado por:** sdd-planner · 2026-10-23

---

## Resumen del ciclo

| Campo | Valor |
| ----- | ----- |
| Ciclo | 2 |
| Módulo | studio-session-ux |
| Tasks | 25 (en tasks.json, todas pending) |
| Estimación total | 86h · 99 SP (~2 semanas de un dev a 40h; el brief estimaba 1.5) |
| Subproyectos | apps/studio-bridge, apps/studio (libs/studio-protocol sin cambios, sin bump) |
| Alcance | HU-1, HU-2, HU-3, CA-016.4, CA-016.5 |

| Fase | Tasks | Horas | SP |
| ---- | ----- | ----- | -- |
| F4 — Puente (apps/studio-bridge) | 12 | 41h | 48 |
| F5 — Web (apps/studio) | 13 | 45h | 51 |

Escala de SP: ≤1h→1 · 2h→2 · 3h→3 · 4h→5. Ninguna task supera 4h. Implementador: **back** = sdd-implementor-back (puente), **front** = sdd-implementor-front (web). Los desvíos X-1..X-9 y la seguridad de rutas (R-C2-2) están en architect.md y se citan por task.

**Camino crítico:** TASK-001 → 003 → 004 → 005 → 010 → 011 → 012 (checkpoint) → 013 → 014 → 016 → 017 → 022 → 023 → 024 → 025.

**Checkpoint F4→F5 (TASK-012):** `pnpm nx run-many -t lint test build -p studio-protocol studio-bridge` en verde; toda task de F5 depende de TASK-012 (directa o transitivamente). El architect permitía arrancar F5 antes contra FakeEngine; se prefirió el corte duro pedido por el dev. Si se quiere paralelizar, las tasks 013, 015, 018, 020 y 021 no consumen el puente real y podrían arrancar tras TASK-003/009.

**Riesgos:** R-C2-1 (frame con PDFs: TASK-013/014), R-C2-2 (rutas: TASK-002, 006, 007), R-C2-4 (web publicada sin features: TASK-023), R-C2-5 (watcher: TASK-008), carrera interrupt↔lectura (TASK-004). Nada de código con comentarios (regla del repo).

---

## F4 — Puente (apps/studio-bridge)

### TASK-001: Puente: attachment-store (put/read/init, magic bytes, dedupe, escritura atómica)

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-1 · **CA:** CA-002.2, CA-003.4
- **Descripción:** sessions/attachment-store.ts (arq §3.1): layout .sdd-studio/attachments/<sha256>.<ext>, revalidación de contenido contra mime, límite MAX_FRAME_BYTES, dedupe por hash, tmp con wx + rename, aviso no bloqueante >1 GiB en init. Sin loguear data.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** ninguna
- **Criterio de done:**
  - [ ] Tests: magic bytes PNG/JPEG/GIF/WEBP/PDF, texto con byte 00, mismatch mime, dedupe, atomicidad
  - [ ] Mensajes de error sin datos ni rutas

### TASK-002: Puente: attachment.get seguro (R-C2-2)

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-1 · **CA:** CA-003.2, CA-003.3
- **Descripción:** Handler de attachment.get según arq §3.2: ruta solo de sha256+EXT_BY_MIME, realpath, O_NOFOLLOW, fstat, recálculo de sha256, not-found genérico.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-001
- **Criterio de done:**
  - [ ] Tests: sha con mayúsculas o ../, symlink plantado, directorio con nombre de sha, archivo > MAX_FRAME_BYTES, contenido alterado, mime cambiado
  - [ ] Falla -> not-found 'attachment not available'

### TASK-003: Puente: frontera del engine, buildTurnPrompt y toSdkUserMessage async (X-1, X-2, X-3)

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-1, HU-3 · **CA:** CA-002.1, CA-002.2, CA-005.2, CA-005.4
- **Descripción:** PromptBlock text|attachment, EngineCallbacks.readAttachment, engine/prompt-content.ts: preámbulo por refs vigentes, strip del /<id> inicial, bloques image/document/text, 'Attachments: ...' sin texto, adjunto faltante, toHookContext.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-001
- **Criterio de done:**
  - [ ] Tests puros del mapeo por tipo y del preámbulo
  - [ ] Texto vacío nunca produce bloque text vacío

### TASK-004: Puente: ClaudeAgentSdkEngine con resolución async y revert en carrera interrupt

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-1 · **CA:** CA-001.5, CA-002.1
- **Descripción:** Prompts iniciales y deliverAtCutPoint/deliverOrClose async (arq §3.5); revertPending si interrupted durante la resolución; collectPending textOnly en hook-context.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-003
- **Criterio de done:**
  - [ ] Tests con engine falso: orden, interrupt durante lectura revierte ids, hook-context solo texto
  - [ ] deliveryMode stream sigue por defecto

### TASK-005: Puente: SessionManager con MessageInput, cola de aceptación por hilo y createThread con adjuntos (X-7)

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-1, HU-3 · **CA:** CA-001.5, CA-005.7
- **Descripción:** MessageInput, Live.acceptTail FIFO, put() en paralelo antes de la decisión síncrona, createThread materializa adjuntos antes de crear el hilo, título por primer adjunto, filtrado y dedupe de refs contra el snapshot, editPending permite vacío con adjuntos.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-001, TASK-003, TASK-004
- **Criterio de done:**
  - [ ] Tests: orden con envío lento y rápido, falla de put no emite y la cola sigue, refs inexistentes descartadas, createThread fallido sin hilo
  - [ ] user.message y pending.added llevan attachments/refs

### TASK-006: Puente: file-index y búsqueda segura (R-C2-2)

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-2 · **CA:** CA-004.3, CA-004.4, CA-004.6
- **Descripción:** workspace/file-index.ts (arq §4): git ls-files con fallback walk, normalización, exclusiones, secretos, ranking, cache 15 s, realpath de la página candidata, truncated.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** ninguna
- **Criterio de done:**
  - [ ] Tests: .env, .env.local, .env.example, id_rsa.pub, node_modules, .claude/worktrees, symlinks fuera del root, '..', ranking, truncated, cache (1 git en 2 búsquedas)

### TASK-007: Puente: catálogo de agentes, skills y prompts (X-8, X-9)

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-3 · **CA:** CA-005.1, CA-005.3, CA-005.6
- **Descripción:** workspace/catalog.ts reemplaza loadAgents: 5 fuentes, contención por realpath, dedupe canónico por realpath, precedencia, validación AgentId/CatalogId, caps 200, lectura 8 KiB; snapshot.skills.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** ninguna
- **Criterio de done:**
  - [ ] Tests: dedupe .claude/agents -> sdd/agents, precedencia, id inválido omitido, prompt vs skill, caps
  - [ ] stale: ['agents'] ante error distinto de ENOENT

### TASK-008: Puente: watcher de .claude acotado a agents y skills (R-C2-5)

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-3 · **CA:** CA-005.5
- **Descripción:** Segundo chokidar.watch sobre .claude con función ignored (solo agents/** y skills/**, depth 3), debounce compartido, close() cierra ambos, wiring en snapshot.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-007
- **Criterio de done:**
  - [ ] Test: cambios en .claude/skills refrescan el catálogo; .claude/worktrees nunca observado
  - [ ] Sin .claude no hay watcher ni error

### TASK-009: Puente: FakeEngine con marcadores de adjuntos y refs

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-1, HU-3 · **CA:** CA-002.2, CA-005.2
- **Descripción:** Eco ' [attachments: ...]' con (missing), ' [refs: @a /b]', #bad-attachment por el camino de #fail, sufijos en heard: de #steps:N (arq §7).
- **Estimación:** 2h · **Story points:** 2
- **Dependencias:** TASK-003
- **Criterio de done:**
  - [ ] Marcadores cubiertos por tests del engine falso
  - [ ] #bad-attachment no reintenta ni auto-envía pendientes

### TASK-010: Puente: activación de capacidades y wiring (router, ws, main)

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-1, HU-2, HU-3 · **CA:** CA-001.6, CA-004.7, CA-005.8
- **Descripción:** welcome().features = BRIDGE_FEATURES, eliminar rejectUnsupportedBody, thread.create/send con attachments y refs, searchFiles y attachment.get en el router, main.ts crea AttachmentStore (+init) y FileIndex.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-002, TASK-005, TASK-006, TASK-008
- **Criterio de done:**
  - [ ] Welcome anuncia attachments, file-search y catalog
  - [ ] Sin PROTOCOL_VERSION bump; protocolo sin cambios

### TASK-011: Puente: tests de integración ws con FakeEngine (adjuntos, búsqueda, catálogo, refs)

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-1, HU-2, HU-3 · **CA:** CA-001.5, CA-003.2, CA-004.4, CA-005.7
- **Descripción:** Suite e2e sobre ws-server real: envío con adjuntos a hilo nuevo y con turno en curso (pendiente), recarga con attachment.get, búsqueda sin secretos, refs, mensaje que excede el frame.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-009, TASK-010
- **Criterio de done:**
  - [ ] Cobertura de los CA listados en verde
  - [ ] Adjunto borrado del disco -> (missing)

### TASK-012: Checkpoint F4: lint, test y build de protocolo y puente en verde

- **Subproyecto:** apps/studio-bridge · **Implementador:** sdd-implementor-back
- **Historia:** HU-1, HU-2, HU-3 · **CA:** CA-001.6
- **Descripción:** pnpm nx run-many -t lint test build -p studio-protocol studio-bridge en verde; verificar que libs/studio-protocol no cambió. Punto de corte: F5 no arranca sin esta task.
- **Estimación:** 2h · **Story points:** 2
- **Dependencias:** TASK-011
- **Criterio de done:**
  - [ ] Comando en verde sin warnings nuevos
  - [ ] git diff de libs/studio-protocol/src vacío o solo aditivo opcional con spec

## F5 — Web (apps/studio)

### TASK-013: Web: classify y encodeImage (re-encode siempre, CA-016.4)

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-1 · **CA:** CA-001.2, CA-002.1, CA-016.4
- **Descripción:** src/lib/attachments/: classify (magic bytes, extensiones, UTF-8 fatal), encodeImage a ≤1568 px sin EXIF, GIF estático si grande, rechazo si el re-encode falla, nombre pasted-HHmmss, pre-chequeos de PDF/texto y máx 5 (arq §6.2).
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-012
- **Criterio de done:**
  - [ ] Tests: tipos aceptados/rechazados, imagen con EXIF/GPS sale sin metadatos, nunca se envía el original
  - [ ] Módulo puro sin React

### TASK-014: Web: commandFrameBytes y escalera de presupuesto (R-C2-1)

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-1 · **CA:** CA-002.3
- **Descripción:** commandFrameBytes sobre el JSON completo y fitFrameBudget con peldaños (1568,.85)->(1024,.6), cache por (adjunto, peldaño), error con exceso y dos adjuntos más pesados.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-013
- **Criterio de done:**
  - [ ] Tests: 5 imágenes entran tras la escalera, PDF en el límite entra y +1 byte falla, PDF+4 imágenes no entra con mensaje, texto con comillas medido

### TASK-015: Web: slice drafts con ComposerDraft y store de timeline con adjuntos/refs (X-4)

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-1 · **CA:** CA-016.5, CA-003.1
- **Descripción:** drafts pasa a Record<string, ComposerDraft>, setDraftText/setDraftAttachments/clearDraft con revoke de previewUrl; attachments/refs en el ítem user y en PendingItem.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-012
- **Criterio de done:**
  - [ ] Tests del reducer: clave borrada sin texto ni adjuntos, revoke de URLs
  - [ ] Borrador por hilo conserva adjuntos al cambiar de hilo y se pierde al recargar

### TASK-016: Web: useAttachmentDraft y AttachmentTray (COMP-007, COMP-012)

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-1 · **CA:** CA-001.3, CA-001.4
- **Descripción:** src/lib/use-attachment-draft.ts y src/components/workspace/AttachmentTray.tsx: add/remove/buildUploads, sha256 con crypto.subtle, chips con miniatura, quitar con aria-label, contador n/5, errores por archivo, zona de drop.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-013, TASK-014, TASK-015
- **Criterio de done:**
  - [ ] Sexto adjunto rechazado con aviso
  - [ ] Quitar actualiza preview y contador

### TASK-017: Web: Composer con elegir, pegar, arrastrar y enviar con adjuntos

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-1 · **CA:** CA-001.1, CA-001.5, CA-002.4, CA-016.5
- **Descripción:** Composer.tsx: botón adjuntar, paste/drop, envío sin texto si hay adjuntos, thread.create y thread.send con attachments, conserva borrador ante error.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-016
- **Criterio de done:**
  - [ ] Sin texto ni adjuntos no se envía
  - [ ] Error de frame conserva texto y adjuntos

### TASK-018: Web: useAttachmentContent (COMP-013) con LRU, concurrencia y verificación de sha256

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-1 · **CA:** CA-003.2
- **Descripción:** src/lib/use-attachment-content.ts: LRU 64 con refcount, concurrencia 2, dedupe en vuelo, attachment.get + AttachmentContent.parse + sha256, precarga desde la pestaña que envía.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-012
- **Criterio de done:**
  - [ ] Tests: no revoca con consumidores montados, dedupe de pedidos, sha distinto -> no disponible

### TASK-019: Web: AttachmentView, Timeline y PendingMessages con adjuntos (COMP-008)

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-1 · **CA:** CA-003.1, CA-003.2, CA-003.3
- **Descripción:** AttachmentView con caja reservada por width/height, PDF y texto como tarjeta, faltante 'adjunto no disponible'; integración en Timeline y chips de solo lectura en PendingMessages.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-015, TASK-018
- **Criterio de done:**
  - [ ] Imagen visible en vivo y tras recargar
  - [ ] Adjunto faltante muestra marcador sin romper el mensaje

### TASK-020: Web: composer-refs (extracción de refs @agente y /skill)

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-3 · **CA:** CA-005.2, CA-005.4, CA-005.7
- **Descripción:** src/lib/composer-refs.ts puro: agents por tokens @id en catálogo (dedupe, máx 5), skills por /id inicial no comando fijo, orden comando fijo -> skill -> parseSlash (arq §6.5).
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-012
- **Criterio de done:**
  - [ ] Tests de tokens, puntuación, dedupe, cap 5 y ids inexistentes
  - [ ] slash.ts intacto

### TASK-021: Web: MentionMenu para @ y / (COMP-009)

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-2, HU-3 · **CA:** CA-004.1, CA-004.2, CA-004.5, CA-004.6, CA-005.1, CA-005.3, CA-005.6
- **Descripción:** src/components/workspace/MentionMenu.tsx: grupos Archivos/Agentes y Comandos/Skills y prompts, debounce 120 ms con descarte por secuencia, estados vacío/carga/error/más resultados, teclado y ARIA combobox/listbox.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-012
- **Criterio de done:**
  - [ ] Inserción: ruta sin @, @<id>, /<id>
  - [ ] Enter con menú abierto no envía

### TASK-022: Web: integración de MentionMenu y refs en el Composer

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-2, HU-3 · **CA:** CA-004.2, CA-005.2, CA-005.4
- **Descripción:** Composer abre el menú por @ y /, inserta, calcula refs al enviar y los manda en thread.create/send.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-017, TASK-020, TASK-021
- **Criterio de done:**
  - [ ] Menciones inexistentes se envían como texto
  - [ ] Mensaje con refs llega con preámbulo (verificado contra FakeEngine)

### TASK-023: Web: gating por features y test de handshake sin features (R-C2-4)

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-1, HU-2, HU-3 · **CA:** CA-001.6, CA-004.7, CA-005.8
- **Descripción:** UI condicionada a supports(attachments|file-search|catalog): sin features no hay adjuntos, ni grupo Archivos, ni Agentes/Skills, y se envía attachments y refs vacíos.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-017, TASK-022
- **Criterio de done:**
  - [ ] Test de handshake con features ausente: ninguna UI aparece ni sale comando con adjuntos o refs
  - [ ] Puente de cycle-01 sigue funcionando

### TASK-024: Web: tests del Composer (adjuntos, menús, EXIF, borrador por hilo)

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-1, HU-2, HU-3 · **CA:** CA-001.1, CA-001.3, CA-001.4, CA-016.4, CA-016.5
- **Descripción:** Specs de componente: elegir/pegar/arrastrar, límite de 5, quitar, menús @ y /, EXIF re-encode, cambio de hilo conserva borrador, envío sin texto.
- **Estimación:** 4h · **Story points:** 5
- **Dependencias:** TASK-019, TASK-023
- **Criterio de done:**
  - [ ] Specs en verde con jsdom por el config de apps/studio

### TASK-025: Web: e2e contra FakeEngine, components.json y checkpoint final

- **Subproyecto:** apps/studio · **Implementador:** sdd-implementor-front
- **Historia:** HU-1, HU-2, HU-3 · **CA:** CA-001.5, CA-003.2, CA-004.3, CA-005.2
- **Descripción:** e2e contra puente+FakeEngine; pasar COMP-007/008/009/012/013 a implemented con updated_in_cycle 2 y paths (arq §9); pnpm nx run-many -t lint test build -p studio-protocol studio-bridge studio en verde.
- **Estimación:** 3h · **Story points:** 3
- **Dependencias:** TASK-024
- **Criterio de done:**
  - [ ] run-many en verde
  - [ ] components.json actualizado y pnpm sdd:validate en verde
