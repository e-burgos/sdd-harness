# spec-e-burgos-022-studio-kit-integrations — cycle-01 — 2026-11-13

## Estado
Feature `kit-integrations`; comandos `kit.integration.status { integration }` → `KitIntegrationStatus` y `kit.integration.set { integration, enabled }` → `KitIntegrationSetResult` (`ok`, `exitCode`, `output` ≤ 8 KiB, `status`); bot event `integration.changed`. `PROTOCOL_VERSION` no cambia.

## Estructura
- `src/kit.ts`: `KIT_INTEGRATIONS`, `KitIntegrationId` (`tucu-ui` | `video-maker`), `KIT_INTEGRATION_HARNESSES`, `KitIntegrationStatus` (con `.catch` tolerantes), `KitIntegrationSetResult`, `MAX_INTEGRATION_OUTPUT_BYTES`; entradas en `commands.ts`, `events.ts` y `limits.ts`.

## Dependencias
- Ninguna nueva.

## Qué sigue
- Nada pendiente de esta spec.
