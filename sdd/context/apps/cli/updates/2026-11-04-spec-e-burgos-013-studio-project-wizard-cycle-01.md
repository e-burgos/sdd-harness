# spec-e-burgos-013-studio-project-wizard — cycle-01 — 2026-11-04

## Estado
Nuevos subcomandos de solo lectura `harness config catalog [--json]` y `harness config validate <archivo|-> [--json]`. `validate` no genera nada: chequea schema, topología de apps y precondiciones de `init`, y devuelve `{ format, cliVersion, ok, issues[], resolved }`; exit 0 válida, 1 con errores, 2 ilegible o sin archivo (acepta `.json`, `.mjs`, `.js` o `-` por stdin, máximo 64 KiB). `catalog` expone tipos de app/lib, servicios, perfiles, patrones, rango de puertos, entradas toleradas del destino y el JSON Schema. Documentados en `apps/cli/README.md` y en el sitio de documentación (es/en). `harness config schema` sin cambios.

## Estructura
- `src/config/catalog.ts`, `src/config/validate.ts` y `src/config/app-options.ts` nuevos; `src/commands/config/index.ts` suma `catalog` y `validate`.
- `init.ts` reutiliza `app-options.ts` en lugar de listas propias; `generators/app-types.ts` expone `collectAppTopologyIssues`, `describeAppStack` y `resolveMfeShell` que consume `validate`.
- Los exit codes viven como constantes (`EXIT_VALID`, `EXIT_INVALID`, `EXIT_UNREADABLE`).

## Dependencias
- Sin librerías nuevas. El puente `@e-burgos/sdd-studio` depende ahora de `@e-burgos/sdd-harness` (`workspace:*`) y fija su versión: el contrato `catalog`/`validate` es consumido por otro subproyecto.

## Qué sigue
- Una subida de la CLI cambia el texto de salida de `init` que clasifica el puente: regrabar los fixtures `apps/studio-bridge/src/wizard/__fixtures__/init-output/` (R-1). Seguimiento posible: `--progress=json` en `init`.
- Orden de release: CLI, después la web, después el puente (R-4).
- Latencia de `config validate` (cada llamada arranca la CLI): modo servidor `--stdin-lines` queda como idea futura (R-2).
