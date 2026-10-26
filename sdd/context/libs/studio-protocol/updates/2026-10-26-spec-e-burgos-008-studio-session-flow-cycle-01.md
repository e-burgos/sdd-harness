# spec-e-burgos-008 cycle-01 — 2026-10-26

## Estado
El contrato suma eventos y comando de preguntas del proveedor, el uso de contexto por hilo, el perfil del repo y el historial con preguntas opt-in. Todo es aditivo y opcional; `PROTOCOL_VERSION` sigue en 2 y `BRIDGE_FEATURES` suma `questions`, `context-usage` y `profile-set`.

## Estructura
- `domain.ts`: `Question`, `QuestionOption`, `QuestionAnswer`, `MAX_QUESTIONS`, `MAX_QUESTION_OPTIONS`, `ContextUsage`, `DevProfile`, `FlowChoice` y `ThreadInfo.contextUsage` (`nullable().optional().catch(null)`).
- `events.ts`: `question.requested { questionId, author, questions }` y `question.resolved { questionId, outcome: answered|declined|cancelled, answers? }`.
- `commands.ts`: `question.answer { questionId, answers, decline }`, `profile.set { profile }` y `includeQuestions` (default `false`) en `thread.history`.
- `limits.ts`: tres features nuevas en `BRIDGE_FEATURES` (14 de las 32 permitidas).

## Dependencias
Sin cambios.

## Qué sigue
- Todo evento nuevo debe filtrarse del historial con un opt-in: una web anterior descarta el frame suelto pero no puede parsear un resultado de comando que lo contenga.
