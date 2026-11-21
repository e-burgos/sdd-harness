# FIX-e-burgos-012 — El puente y el mod no se bloquean entre sí por la misma conversación

## Problema
En una sesión de Studio con el mod de Claude Code prendido, el hook del mod reserva el archivo con el id de sesión del motor (`session_id` del SDK, harness `claude-code`) y el juez del puente evalúa la misma edición con su propio id (`studio-…`): ve el archivo reservado por «otra sesión» y la rechaza. Toda edición de código de la conversación (y de sus subagentes) queda bloqueada por sí misma.

## Solución aplicada
- El puente trata el `session_id` del SDK de cada hilo (lo recibe en `system/init`) como alias de su sesión: una reserva de ese alias cuenta como propia al juzgar y se renueva en vez de rechazar.

### Archivos modificados
- `apps/studio-bridge/src/sessions/session-bindings.ts`
- `apps/studio-bridge/src/sessions/session-manager.ts`
- `apps/studio-bridge/src/sessions/session-bindings.spec.ts`

El juicio vive en la lib del kit (`sdd/scripts/lib/session-registry.mjs`, `judgeFileLease`, compara `session_id` exacto); el alias se resuelve en el puente sin tocar el kit.
