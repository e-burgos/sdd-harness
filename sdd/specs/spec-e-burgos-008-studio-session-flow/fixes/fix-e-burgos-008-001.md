# FIX-e-burgos-008-001 — Conversaciones preparadas en cascada por specs y fixes ya terminados

| Campo         | Valor |
| ------------- | ----- |
| **ID**        | FIX-e-burgos-008-001 |
| **Tipo**      | BUGFIX |
| **Severidad** | medium |
| **Fecha**     | 2026-10-26 |
| **Autor**     | e-burgos |
| **Estado**    | validated |
| **Spec**      | spec-e-burgos-008-studio-session-flow |

## Problema

Con el puente ya en uso, Studio mostró un aviso «Conversación nueva lista» por cada spec y fix existentes (incluidos los completados), tapando el espacio de trabajo. El puente anuncia `spec.created`, `cycle.opened` y `fix.created` cuando su snapshot ve algo que antes no estaba; si el snapshot se reconstruye, anuncia todo de nuevo, y la web preparaba una conversación por cada evento sin filtrar.

## Solución

`prepareFromBotEvent` solo prepara objetivos abiertos (spec `draft`/`in-progress`, ciclo `in-progress`, fix `pending`/`in-progress` según el snapshot) y mantiene como máximo `MAX_PREPARED` (3) a la vez. No cambia contratos.

## Archivos

- `apps/studio/src/lib/auto-conversation.ts`, `apps/studio/src/lib/store/state.ts`
- Pruebas: `auto-conversation.spec.ts`, `prepared.spec.tsx`, `workspace.spec.tsx`

## Pendiente

Causa de fondo en el puente: un snapshot reconstruido genera `*.created` falsos también en el canal del bot. No se tocó ni se reprodujo.
