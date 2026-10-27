# spec-e-burgos-009 cycle-01 — 2026-10-27

## Qué pasó
TASK-001 se dio por verificada con el e2e 8/8, pero el e2e de Studio sirve `apps/studio-bridge/dist/web`, una copia de `apps/studio/out` que solo se actualiza al compilar el bridge: había corrido contra la UI vieja. Se detectó en TASK-002 al ver en el navegador Space Grotesk en vez de Inter.

## Lección
Antes de dar por bueno un e2e de Studio después de tocar la web, correr `build:local` y luego `pnpm --filter sdd-studio build`, y confirmar en el navegador que se sirve el build nuevo.

## Costo evitable
Una verificación repetida y un reporte de TASK-001 que hubo que corregir ante el dev.
