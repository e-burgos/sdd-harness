# spec-e-burgos-005 cycle-01 — 2026-10-26

## Qué pasó
`pnpm test` en la raíz corre las suites de cada paquete en paralelo y corta en el primer paquete que falla (`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`). Un test de integración de `apps/cli` agotó su timeout de 30 s bajo la carga paralela y dejó sin resumen las suites de `studio-bridge` y `studio`, que parecían no haber corrido. Al correr cada filtro por separado todo estaba en verde, incluido el test que había fallado.

## Lección
Si `pnpm test` raíz falla por un timeout, correr cada paquete con `pnpm --filter <pkg> test` antes de concluir que algo se rompió; el fallo de un paquete oculta el resultado de los demás.

## Costo evitable
Una corrida completa extra de la suite y la duda sobre si el diff del ciclo había roto algo que no tocaba (`apps/cli` no cambió).
