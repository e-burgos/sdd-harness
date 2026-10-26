# FIX-e-burgos-005-005 — Studio Mission Control: Sesion y proveedor visibles

| Campo         | Valor                                          |
| ------------- | ---------------------------------------------- |
| **ID**        | FIX-e-burgos-005-005                               |
| **Tipo**      | BUGFIX                                       |
| **Severidad** | medium                                       |
| **Fecha**     | 2026-10-26                                     |
| **Autor**     | e-burgos                                       |
| **Estado**    | implemented                                        |
| **Spec**      | spec-e-burgos-005-studio-conversation-sessions         |

## Problema

'PROVEEDOR proveedor no informado / SESION sesion no informada' sigue apareciendo.

Diagnostico con evidencia: las conversaciones son hilos del bridge (thread.updated -> state.ts:131), no sesiones externas; no hay ingesta de hooks ni lectura de ~/.claude/projects (grep sin resultados en apps/studio-bridge/src). El bridge en ejecucion (PID 44838, inicio 11:26) es anterior a 414b1fd (11:42), cuyo `toThreadInfo` (store.ts:19) ya no hace `engineSessionId: _session` descartado (version previa, store.ts:18) ni garantiza provider. .sdd-studio/threads.json tiene engineSessionId reales y provider ausente en los 7 hilos hasta que un bridge nuevo migre (store.ts:116). El front muestra 'no informado' cuando el campo es undefined (ConversationSessionInfo.tsx:14-15).

## Solucion propuesta

- UI: undefined -> aviso 'bridge desactualizado, reinicialo' distinto de null -> 'Sin sesion todavia'; id de sesion completo con boton copiar (el id es el de `claude --resume <id>`).
- Operativo: reiniciar el bridge tras el build.
- Fuera de alcance (requiere spec): titulo de /resume. El SDK expone `getSessionInfo(sessionId)` -> `SDKSessionInfo.summary/customTitle` (sdk.d.ts ~L864, L5845); mostrarlo exige un campo opcional aditivo (p. ej. `sessionTitle`) en ThreadInfo de libs/studio-protocol + lectura en el bridge. Mismo patron que spec-005 TASK-001/004, pero toca el contrato: el FIX GATE lo prohibe, va como ciclo nuevo.

## Archivos esperados

- `apps/studio/src/components/mission-control/ConversationSessionInfo.tsx`
- `apps/studio/src/components/mission-control/ConversationSessionInfo.spec.tsx`
- `apps/studio/src/lib/i18n/es.ts`
- `apps/studio/src/lib/i18n/en.ts`
