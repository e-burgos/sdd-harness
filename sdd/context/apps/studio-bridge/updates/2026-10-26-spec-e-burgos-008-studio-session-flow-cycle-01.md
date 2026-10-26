# spec-e-burgos-008 cycle-01 — 2026-10-26

## Estado
El puente publica las preguntas del proveedor como `question.requested`/`question.resolved` y devuelve la respuesta al motor, publica el contexto usado y la ventana del modelo por hilo (`ThreadInfo.contextUsage`) y escribe el perfil del repo a pedido (`profile.set`). `PROTOCOL_VERSION` sigue en 2.

## Estructura
- `engine/types.ts`: `ApprovalDecision` allow admite `updatedInput`; `EngineCallbacks.onContextUsage?`.
- `engine/claude-sdk-engine.ts`: `canUseTool` devuelve `decision.updatedInput ?? toolInput` (así viaja `{ questions, answers }` de `AskUserQuestion`); tras cada `result` lee `query.getContextUsage({ detail: 'summary' })` con tope de 2 s, mejor esfuerzo, y lo informa por `onContextUsage`.
- `engine/fake-engine.ts`: marcadores `#ask` y `#ctx:N`.
- `sessions/session-manager.ts`: `requestApproval` desvía `AskUserQuestion` a `requestQuestion` si el input parsea; `answerQuestion` exige cubrir cada pregunta una vez (un valor salvo selección múltiple); declinar o interrumpir cancela; `recover()` cancela las preguntas abiertas; `hasPendingPrompts` mantiene `waiting-approval` mientras haya aprobaciones o preguntas; `applyContextUsage`; `history(threadId, sinceSeq, includeDocumentTouched, includeQuestions)` oculta los eventos de pregunta por defecto.
- `sessions/presence.ts`: una pregunta abierta cuenta como agente esperando.
- `sessions/store.ts`: `contextUsage` se valida al cargar y se descarta si es inválido.
- `workspace/profile.ts` (`writeProfile`, escritura atómica de `sdd/global.json`) y `server/router.ts` (`question.answer`, `profile.set`).

## Dependencias
Sin dependencias nuevas; `@anthropic-ai/claude-agent-sdk` sigue en 0.3.292 (una actualización exige re-verificar `AskUserQuestion` vía `updatedInput.answers` y `getContextUsage`).

## Qué sigue
- Una web anterior descarta en silencio `question.requested` y el turno queda esperando hasta interrumpirlo; por eso el historial solo lo incluye con `includeQuestions`.
- `getContextUsage` se pide después de cada resultado; si el SDK lo vuelve costoso, pedirlo solo al cruzar el umbral.
