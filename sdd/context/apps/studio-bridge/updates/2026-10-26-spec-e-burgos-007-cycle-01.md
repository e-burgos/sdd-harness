# spec-e-burgos-007 cycle-01 — 2026-10-26

## Estado
El puente publica el título de sesión (`sessionTitle`), persiste asociaciones múltiples con origen por hilo y registra `document.touched` para Write/Edit/MultiEdit/NotebookEdit (exacto) y para los archivos de `sdd/` que cambia un Bash (instantánea antes/después). Webs anteriores siguen funcionando: `PROTOCOL_VERSION` queda en 2.
- resuelve: base §3.3 `thread-link.ts` «reasignación manual con `thread.setLink`» (ahora `setLink` es compatibilidad sobre `targets`) y `store.ts` «`link` persistido por hilo» (ahora con `targets` y `sessionTitle`).

## Estructura
- `engine/types.ts`: `AgentEngine.readSessionTitle?`, `ToolRunContext`, `ToolOutcome` y callbacks opcionales `beforeTool`/`afterTool`/`rebaseTool`/`cancelTool` en `EngineCallbacks`.
- `engine/claude-sdk-engine.ts`: 4.º parámetro `sessionInfoFn` (por defecto `getSessionInfo`); `pickSessionTitle` y `cleanTitle` (`customTitle`, si no `summary` distinto de `firstPrompt`, si no `null`; máximo `SESSION_TITLE_MAX`). `readSessionTitle` rechaza ante un fallo del SDK y devuelve `null` si la sesión no existe. Hooks `PostToolUse` y `PostToolUseFailure` y `beforeTool` en `PreToolUse` para `TRACKED_TOOLS`; `canUseTool` llama `rebaseTool` al permitir y `cancelTool` al denegar.
- `engine/tool-summary.ts`: `summarizeToolDetailed` y `BASH_SUMMARY_MAX = 600` (cabeza cortada en espacio, rutas `sdd/` completas, sin saltos de línea); `summarizeTool` queda como envoltorio. `sdk-mapper.ts` emite `summaryTruncated: true` solo cuando hubo recorte.
- `engine/fake-engine.ts`: marcadores `#write-doc`, `#bash-doc` y `#title:<texto>`; `setSessionTitle`.
- `sessions/document-tracker.ts` (nuevo): `DocumentChangeTracker` con instantánea de `sdd/` por metadatos (`SNAPSHOT_MAX_ENTRIES` 20 000, `SNAPSHOT_BUDGET_MS` 250, `MAX_TOUCHED_PER_TOOL` 50), ventanas por `toolUseId`, atribución (certera sin solapes; al hilo sin autor específico con solapes del mismo hilo; por directorio de spec entre hilos; si no se puede, se omite) y anillo de toques exactos para no duplicar.
- `sessions/thread-link.ts`: álgebra pura de asociaciones (`addManual`, `removeRef`, `detectRef`, `detectRefs`, `legacyTargetOf`, `linkTargetExists` ampliado a spec). Quitar una asociación activa, manual incluida, la deja como descartada persistente; la detección nunca la reagrega ni pisa una manual.
- `sessions/store.ts`: `StoredLink.targets` (con `dismissed?`), `StoredThread.sessionTitle`; `toThreadInfo` filtra las descartadas; `migrateStoredLink` idempotente por hilo; un `threads.json` ilegible o que no es arreglo se renombra a `threads.json.corrupt-<epoch>` y se informa, ya no se sobrescribe con `[]`; un error de lectura distinto de `ENOENT` hace fallar `init()`.
- `sessions/session-manager.ts`: refresco del título en `onSessionId` y en cada `turn.end` (un vuelo por hilo, tope de 3 s, error a `reportError` conservando el último título) y backfill de hasta 20 hilos tras `recover()`; `updateLinks`; `setLink` legado sobre `targets`; emisión de `document.touched`, `detectLinks` con reintento de rutas no resueltas tras `refreshSnapshot`; `history(threadId, sinceSeq, includeDocumentTouched)` filtra `document.touched` por defecto; cierre de las ventanas abiertas del hilo (`DocumentChangeTracker.closeThread`) al terminar el turno. `SessionManagerDeps.tracker` y `titleTimeoutMs` inyectables.
- `server/router.ts`: `thread.updateLinks` y `thread.history` con `includeDocumentTouched`.

## Dependencias
Sin dependencias nuevas; `@anthropic-ai/claude-agent-sdk` sigue pinneado en 0.3.292 (una actualización exige re-verificar `pickSessionTitle` y los campos de `PostToolUseHookInput`).

## Qué sigue
- Bash en segundo plano (`run_in_background`) solo se observa mientras dura su tool; las escrituras fuera de `sdd/` durante un Bash no se detectan.
- Un `touch` sin cambio de contenido cuenta como `modified` (no se hashea el contenido anterior).
- Optimización futura si el costo de recorrer `sdd/` dos veces por Bash molesta: reusar la instantánea como índice vivo alimentado por el watcher.
- Re-verificar `pickSessionTitle` si aparecen títulos que son prompts (degradar a solo `customTitle`).
