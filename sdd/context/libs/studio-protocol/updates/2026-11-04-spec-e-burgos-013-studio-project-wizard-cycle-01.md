# spec-e-burgos-013-studio-project-wizard — cycle-01 — 2026-11-04

## Estado
`PROTOCOL_VERSION` sigue en 2. El handshake acepta `workspace: null` (puente en modo launcher) y anuncia las features `project-wizard` y `workspace-switch`. Comandos nuevos: `wizard.catalog`, `wizard.preflight`, `wizard.validate`, `wizard.listDirs`, `wizard.checkTarget`, `wizard.generate`, `wizard.generation.get`, `wizard.generation.cancel`, `wizard.reveal` y `workspace.open`. Eventos nuevos: `generation.status`, `generation.output` (con `seq`) y `workspace.switched`.

## Estructura
- `src/wizard.ts` nuevo con los schemas (`ConfigDraft`, `ConfigCatalog`, `ConfigValidation`, `Preflight`, `DirListing`, `TargetCheck`/`TargetState`, `GenerationState`/`Stage`/`Status`, `GenerateResult`, `GenerationSnapshot`, `WorkspaceOpenResult`); cambios en `commands.ts`, `events.ts`, `handshake.ts` y `index.ts`.
- `src/limits.ts`: `MAX_CONFIG_BYTES` (64 KiB), `GENERATION_CHUNK_MAX`, `GENERATION_BUFFER_BYTES` (4 MiB), `MAX_DIR_ENTRIES`, `WS_CLOSE_WORKSPACE_SWITCHED` (4010).

## Dependencias
- Sin cambios.

## Qué sigue
- Los schemas reflejan el contrato `config catalog`/`validate` de la CLI: un cambio de ese contrato se versiona aquí y en el puente a la vez.
