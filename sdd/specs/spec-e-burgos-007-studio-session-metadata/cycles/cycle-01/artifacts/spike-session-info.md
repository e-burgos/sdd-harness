# Spike: SDKSessionInfo.customTitle / summary / firstPrompt

Fecha: 2026-10-26. SDK `@anthropic-ai/claude-agent-sdk@0.3.292`. Medición read-only con `listSessions` + `getSessionInfo(sessionId, { dir })` sobre las sesiones locales de este repo (solo se contaron condiciones, no se copió contenido).

## Resultados (19 sesiones)

| Condición | Sesiones |
| --------- | -------- |
| `getSessionInfo` devolvió `undefined` | 0 |
| con `customTitle` (incluye el título automático) | 17 |
| `summary` vacío | 0 |
| `summary` igual a `firstPrompt` (sin customTitle) | 1 |
| `summary` distinto de `firstPrompt` y sin `customTitle` | 1 |

## Criterio fijado

`pickSessionTitle`: `customTitle` limpio; si no, `summary` limpio solo si es distinto de `firstPrompt` (RN-03); si no, `null`. Vacío o error de lectura devuelve `null` (RN-04, CE-01).

## Riesgo residual (R-2)

La muestra es chica y la mayoría de las sesiones ya traen `customTitle`. `SDKSessionInfo` no expone el último prompt, así que en el único caso sin `customTitle` y con `summary` distinto del primer prompt no se puede distinguir un resumen real de un último prompt. Si en uso real aparecen títulos que son prompts, degradar `pickSessionTitle` a solo `customTitle` (una línea).
