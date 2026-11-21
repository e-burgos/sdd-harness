# FIX-e-burgos-014 — Studio ata la conversación a su unidad de forma automática y permisiva

## Problema
El puente toma como unidad de un hilo la última asociación de ciclo o fix en orden de lista
(`legacyTargetOf`): ignora las asociaciones de spec, no descarta unidades cerradas, no reordena una unidad
que se vuelve a detectar e ignora las marcas `SDD-BIND` de `sdd:use`/GATE A-B. Una conversación quedó trabada en
un fix cerrado y el SPEC GATE rechazó toda edición hasta quitar cuatro asociaciones a mano.

## Solución aplicada
- La unidad del hilo es la última asociación **abierta** (las cerradas se saltean).
- Una marca `SDD-BIND` en la salida de un comando del hilo lo ata a esa unidad (asociación explícita, al final).
- Una asociación de spec con un solo ciclo abierto cuenta como ese ciclo.
- Volver a detectar una unidad ya asociada la pasa al final.
- Sin unidad abierta asociada y con una sola unidad abierta en el repo, se usa esa (como el mod).

### Archivos modificados
- `apps/studio-bridge/src/sessions/thread-link.ts`
- `apps/studio-bridge/src/sessions/session-manager.ts`
- `apps/studio-bridge/src/engine/types.ts`
- `apps/studio-bridge/src/engine/claude-sdk-engine.ts`
- `apps/studio-bridge/src/engine/fake-engine.ts`
- `apps/studio-bridge/src/sessions/thread-link.spec.ts`
- `apps/studio-bridge/src/sessions/session-manager.spec.ts`

Parser propio de `SDD-BIND` en el puente (ata solo unidades que existen en el snapshot); la salida de Bash llega al session-manager por `ToolRunContext.output` (tipo interno).
