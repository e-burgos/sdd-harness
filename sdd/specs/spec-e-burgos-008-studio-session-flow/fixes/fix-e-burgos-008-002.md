# FIX-e-burgos-008-002 — Tests de cola de SessionManager dependientes del reloj fallan en Windows

| Campo         | Valor |
| ------------- | ----- |
| **ID**        | FIX-e-burgos-008-002 |
| **Tipo**      | BUGFIX |
| **Severidad** | low |
| **Fecha**     | 2026-11-03 |
| **Autor**     | e-burgos |
| **Estado**    | validated |
| **Spec**      | spec-e-burgos-008-studio-session-flow |

## Problema

En el CI de Windows (PR #63) fallaron `#bad-attachment ends in error…` y `collectPending textOnly…`: el motor terminaba el turno a los 40/60 ms, antes de que el `send` con adjunto llegara, y el mensaje salía `started` en vez de quedar `pending`.

## Solución

Solo tests: el motor espera una señal que el test abre después de encolar los mensajes (`heldUntilOpened` y una promesa `released`), en lugar de un plazo fijo. Sin cambios de código productivo.

## Archivos

- `apps/studio-bridge/src/sessions/session-manager.spec.ts`

## Validación

CI de PR #63 en verde en `ubuntu-latest` y `windows-latest` (head 36bb829), mergeado a main el 2026-11-03.
