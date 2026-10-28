# libs/studio-protocol — spec-e-burgos-010-studio-dual-sidebar · cycle-01

## Estado
PROTOCOL_VERSION sigue en 2. Se suman las features `kit-index`, `kit-tools` y `rtk-gain`, los comandos `kit.index`, `kit.tools.set` (con `expectedRevision`) y `kit.rtkGain`, el evento `kit.changed`, el bot event `tools.changed` y `includeKitEvents` en `channel.botHistory`; el snapshot lleva `tools` opcional.

## Estructura
- `src/kit.ts` nuevo; cambios en límites, snapshot, comandos y eventos.

## Dependencias
- Sin cambios.

## Qué sigue
- Campos de hora en aprobaciones y preguntas.
