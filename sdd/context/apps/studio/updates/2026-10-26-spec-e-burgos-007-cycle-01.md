# spec-e-burgos-007 cycle-01 — 2026-10-26

## Estado
Studio muestra el título real de la sesión del proveedor, todas las asociaciones de un hilo con su origen y los documentos tocados que registra el puente, también los escritos por Bash. Convive con puentes anteriores: lo que el puente no anuncia se degrada con un aviso no bloqueante en lugar de mostrar datos vacíos.
- resuelve: «Qué sigue» del base (título de sesión de `/resume` vía `sessionTitle`).
- resuelve: «Qué sigue» del fragmento 2026-10-26-fix-e-burgos-005-006-011 (documentos por `document.touched` y asociaciones múltiples).

## Estructura
- `lib/store/timeline.ts`: `ThreadState.touched: TouchedDocument[]` (`{ seq, path, op, author }`) poblado por `document.touched`; no entra en `items`. `TimelineItem` tool lleva `summaryTruncated`; `isToolSummaryClipped` cae al `…` final con puentes viejos.
- `lib/conversation.ts`: precedencia de documentos por corte de `seq`. `cutoffSeq` es el menor `seq` de `touched`; antes del corte rige la heurística de FIX-e-burgos-005-006 (`relatedDocuments(thread, snapshot, beforeSeq)`), desde el corte rigen los toques (`structuredDocuments`); una ruta presente en ambos tramos se fusiona en un registro (`agents` unión, `op` y orden del último toque). `ConversationDocument.op?`, `ConversationView.documentSource` (`structured | heuristic | mixed`) y `sessionTitle`. Un hilo sin toques usa solo la heurística.
- `lib/link-targets.ts` (nuevo, puro): `linkEntriesOf` (usa `link.targets`; con puente viejo deriva una entrada de `link.target`), `isLinkEntryAvailable`, `linkRefLabel`, `linkRefKey`, `toLinkRef`.
- `lib/use-bridge-features.ts` (COMP-022) y `components/mission-control/CapabilityNotice.tsx` (COMP-021): `supports` sobre `client.supports` y aviso de capacidades faltantes (`session-title`, `link-targets`, `document-touched`) en `ThreadLinkPicker` y `ConversationPanelSections`; claves `caps.*` en i18n.
- `ThreadLinkPicker` (COMP-005): con `link-targets` es una lista de chips con origen, estado «no disponible» y quitar, más un selector para agregar spec, ciclo o fix aún no asociados, vía `thread.updateLinks`; sin `link-targets` conserva el selector único con `thread.setLink`. La nota de asociación detectada de solo lectura (por menciones de la web) sigue mostrándose cuando el hilo no tiene ninguna asociación; las persistidas por el puente la reemplazan en cuanto existen.
- `lib/store/nav-tree.ts`: el hilo cuelga de cada asociación (`cycle`, `fix`, nodo «Sin ciclo» para `spec`); sin asociaciones cae a la ubicación por canal. `state.ts`: `sameInfo` compara `sessionTitle`.
- `lib/bootstrap.ts`: `thread.history` pide `includeDocumentTouched` solo si el puente anuncia `document-touched`.
- `ConversationSessionInfo` (COMP-017): tres estados del título (título, «sin título disponible», aviso de puente desactualizado). `RelatedDocuments` (COMP-018): operación y fuente del documento. `Timeline`: indicador de resumen recortado.
- E2E: `e2e/session-metadata.e2e.ts` (nuevo, `#bash-doc` con `--engine fake`); `e2e/studio.e2e.ts` con selectores actualizados (venían rotos desde antes de spec-005).
- `lib/no-fabricated-data.spec.ts`: patrones nuevos contra `sessionTitle` y `document.touched` literales; `session-title` (nombre de feature) queda fuera del patrón de ids de sesión.

## Dependencias
Sin dependencias nuevas.

## Qué sigue
- Hilos anteriores que siguen activos con un puente nuevo quedan en época mixta (heurística hasta el primer toque, `document.touched` después); si el historial llega recortado el corte se desplaza hacia un `seq` mayor y la heurística cubre el tramo.
- Un `Write` denegado por el gate sigue listado por la heurística en hilos sin ningún toque estructurado.
- Renombrar sesiones desde la web y otros proveedores siguen fuera de alcance.
